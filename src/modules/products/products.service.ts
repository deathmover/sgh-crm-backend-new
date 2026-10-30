import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../config/database.config';
import { dayRange } from '../../common/utils/date-range';
import { CreateProductDto, EntryItemInputDto, RestockDto, UpdateProductDto } from './dto/product.dto';

type Tx = Prisma.TransactionClient;

export interface ItemLine {
  productId: string | null;
  name: string;
  unitPrice: number;
  unitCost: number | null;
  quantity: number;
  total: number;
}

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(includeInactive = false) {
    const [products, soldToday] = await Promise.all([
      this.prisma.product.findMany({
        where: includeInactive ? {} : { isActive: true },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.entryItem.groupBy({
        by: ['productId'],
        where: { createdAt: dayRange(), productId: { not: null }, entry: { isDeleted: false } },
        _sum: { quantity: true },
      }),
    ]);
    const sold = new Map(soldToday.map((s) => [s.productId, s._sum.quantity || 0]));
    return products.map((p) => ({
      ...p,
      soldToday: sold.get(p.id) || 0,
      isLowStock: p.stock <= p.lowStockLevel,
    }));
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(dto: CreateProductDto) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: dto.name.trim(),
          category: dto.category ?? 'drinks',
          price: dto.price,
          costPrice: dto.costPrice ?? null,
          stock: dto.stock ?? 0,
          lowStockLevel: dto.lowStockLevel ?? 5,
        },
      });
      if (dto.stock) {
        await tx.stockMovement.create({
          data: { productId: product.id, change: dto.stock, reason: 'restock', note: 'Opening stock' },
        });
      }
      return product;
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    const { stock: _ignored, ...data } = dto; // stock only changes via restock/sales
    return this.prisma.product.update({
      where: { id },
      data: { ...data, ...(data.name && { name: data.name.trim() }) },
    });
  }

  /** Products that were never sold are deleted; others are hidden so past bills keep their names. */
  async remove(id: string) {
    await this.findOne(id);
    const sold = await this.prisma.entryItem.count({ where: { productId: id } });
    if (sold === 0) {
      await this.prisma.product.delete({ where: { id } });
      return { id, result: 'deleted' as const };
    }
    await this.prisma.product.update({ where: { id }, data: { isActive: false } });
    return { id, result: 'archived' as const };
  }

  async restock(id: string, dto: RestockDto) {
    await this.findOne(id);
    if (dto.quantity === 0) throw new BadRequestException('Quantity cannot be 0');
    return this.prisma.$transaction(async (tx) => {
      await tx.stockMovement.create({
        data: { productId: id, change: dto.quantity, reason: dto.quantity > 0 ? 'restock' : 'adjust', note: dto.note },
      });
      return tx.product.update({
        where: { id },
        data: {
          stock: { increment: dto.quantity },
          ...(dto.costPrice !== undefined && { costPrice: dto.costPrice }),
        },
      });
    });
  }

  async movements(id: string, limit = 50) {
    await this.findOne(id);
    return this.prisma.stockMovement.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ─── Used by sessions ──────────────────────────────────────────

  /**
   * Turn requested lines into priced lines. Prices come from the menu, except
   * for lines already on the bill, which keep the price they were sold at.
   */
  async buildLines(tx: Tx, inputs: EntryItemInputDto[], existing: ItemLine[] = []): Promise<ItemLine[]> {
    const productIds = [...new Set(inputs.map((i) => i.productId).filter((id): id is string => !!id))];
    const products = await tx.product.findMany({ where: { id: { in: productIds } } });
    const byId = new Map(products.map((p) => [p.id, p]));
    const existingPrice = new Map(existing.filter((l) => l.productId).map((l) => [l.productId, l]));

    // Merge duplicate product lines
    const merged = new Map<string, ItemLine>();
    const others: ItemLine[] = [];
    for (const input of inputs) {
      if (input.productId) {
        const product = byId.get(input.productId);
        if (!product) throw new BadRequestException('A selected item no longer exists');
        const prior = existingPrice.get(product.id);
        if (!product.isActive && !prior) throw new BadRequestException(`${product.name} has been removed from the menu`);
        const line = merged.get(product.id);
        if (line) {
          line.quantity += input.quantity;
          line.total = line.unitPrice * line.quantity;
        } else {
          const unitPrice = prior?.unitPrice ?? product.price;
          merged.set(product.id, {
            productId: product.id,
            name: prior?.name ?? product.name,
            unitPrice,
            unitCost: prior?.unitCost ?? product.costPrice ?? null,
            quantity: input.quantity,
            total: unitPrice * input.quantity,
          });
        }
      } else {
        const unitPrice = input.unitPrice ?? 0;
        if (unitPrice <= 0) continue;
        others.push({
          productId: null,
          name: input.name?.trim() || 'Other',
          unitPrice,
          unitCost: null,
          quantity: input.quantity,
          total: unitPrice * input.quantity,
        });
      }
    }
    return [...merged.values(), ...others];
  }

  /** Move stock by the difference between two versions of a bill. */
  async applyStockDiff(tx: Tx, entryId: string, before: ItemLine[], after: ItemLine[]) {
    const qty = (lines: ItemLine[]) => {
      const m = new Map<string, number>();
      for (const l of lines) if (l.productId) m.set(l.productId, (m.get(l.productId) || 0) + l.quantity);
      return m;
    };
    const was = qty(before);
    const now = qty(after);
    for (const productId of new Set([...was.keys(), ...now.keys()])) {
      const change = (was.get(productId) || 0) - (now.get(productId) || 0); // selling more = negative
      if (change === 0) continue;
      await tx.stockMovement.create({
        data: { productId, change, reason: change < 0 ? 'sale' : 'return', entryId },
      });
      await tx.product.update({ where: { id: productId }, data: { stock: { increment: change } } });
    }
  }

  /** Put a session's items back in stock (delete) or take them out again (restore). */
  async moveEntryStock(entryId: string, direction: 'return' | 'sale') {
    const items = await this.prisma.entryItem.findMany({ where: { entryId, productId: { not: null } } });
    if (items.length === 0) return;
    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        const change = direction === 'return' ? item.quantity : -item.quantity;
        await tx.stockMovement.create({ data: { productId: item.productId!, change, reason: direction, entryId } });
        await tx.product.update({ where: { id: item.productId! }, data: { stock: { increment: change } } });
      }
    });
  }
}
