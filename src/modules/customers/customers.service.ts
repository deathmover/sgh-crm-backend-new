import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../config/database.config';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async create(createCustomerDto: CreateCustomerDto) {
    const { phone } = createCustomerDto;

    // Check for duplicate phone
    if (phone) {
      const existingByPhone = await this.prisma.customer.findUnique({
        where: { phone },
      });
      if (existingByPhone) {
        throw new ConflictException('Customer with this phone already exists');
      }
    }

    return this.prisma.customer.create({
      data: createCustomerDto,
    });
  }

  async findAll(query: CustomerQueryDto) {
    const { search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          pendingCredit: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data: customers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        entries: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            machine: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
        _count: {
          select: { entries: true },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Calculate total spent
    const totalSpent = await this.prisma.entry.aggregate({
      where: { customerId: id },
      _sum: { finalAmount: true },
    });

    return {
      ...customer,
      totalSpent: totalSpent._sum.finalAmount || 0,
    };
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto) {
    await this.findOne(id);

    const { phone } = updateCustomerDto;

    // Check for duplicate phone if updating phone
    if (phone) {
      const existingByPhone = await this.prisma.customer.findUnique({
        where: { phone },
      });
      if (existingByPhone && existingByPhone.id !== id) {
        throw new ConflictException('Customer with this phone already exists');
      }
    }

    return this.prisma.customer.update({
      where: { id },
      data: updateCustomerDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.customer.delete({
      where: { id },
    });
  }

  async getCustomerStats(id: string) {
    // Get customer with pending credit
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      select: { pendingCredit: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const stats = await this.prisma.entry.aggregate({
      where: { customerId: id, isDeleted: false },
      _sum: {
        finalAmount: true,
        duration: true,
      },
      _count: true,
    });

    const lastEntry = await this.prisma.entry.findFirst({
      where: { customerId: id, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    return {
      totalVisits: stats._count,
      totalSpent: stats._sum.finalAmount || 0,
      pendingCredit: customer.pendingCredit,
      lastVisit: lastEntry?.createdAt?.toISOString(),
    };
  }

  async payCredit(
    customerId: string,
    paymentDto: { cashAmount: number; onlineAmount: number },
  ) {
    // Verify customer exists
    await this.findOne(customerId);

    const { cashAmount, onlineAmount } = paymentDto;
    const totalPayment = cashAmount + onlineAmount;

    if (totalPayment <= 0) {
      throw new ConflictException('Payment amount must be greater than 0');
    }

    // Get all unpaid/partial entries for this customer
    const unpaidEntries = await this.prisma.entry.findMany({
      where: {
        customerId,
        endTime: { not: null },
        creditAmount: { gt: 0 },
        isDeleted: false,
      },
      orderBy: { endTime: 'asc' }, // Pay off oldest debts first
    });

    if (unpaidEntries.length === 0) {
      throw new ConflictException('Customer has no pending credit');
    }

    let remainingPayment = totalPayment;
    const updatedEntries: any[] = [];

    // Distribute payment across unpaid entries
    for (const entry of unpaidEntries) {
      if (remainingPayment <= 0) break;

      const entryCredit = entry.creditAmount || 0;
      const paymentForEntry = Math.min(remainingPayment, entryCredit);

      // Calculate how to split the payment (proportionally based on input)
      const cashForEntry =
        cashAmount > 0 ? (paymentForEntry * cashAmount) / totalPayment : 0;
      const onlineForEntry =
        onlineAmount > 0 ? (paymentForEntry * onlineAmount) / totalPayment : 0;

      // Update entry with payment
      const updatedEntry = await this.prisma.entry.update({
        where: { id: entry.id },
        data: {
          cashAmount: (entry.cashAmount || 0) + cashForEntry,
          onlineAmount: (entry.onlineAmount || 0) + onlineForEntry,
          creditAmount: entryCredit - paymentForEntry,
          paymentStatus:
            entryCredit - paymentForEntry === 0
              ? 'paid'
              : (entry.cashAmount || 0) +
                    (entry.onlineAmount || 0) +
                    cashForEntry +
                    onlineForEntry >
                  0
                ? 'partial'
                : 'unpaid',
        },
      });

      updatedEntries.push(updatedEntry);
      remainingPayment -= paymentForEntry;
    }

    return {
      success: true,
      totalPayment,
      entriesUpdated: updatedEntries.length,
      remainingCredit: remainingPayment,
    };
  }

  async bulkImport(customers: Array<{
    name: string;
    phone: string;
    email?: string;
    creditAmount?: number;
    notes?: string;
  }>) {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ name: string; phone: string; error: string }>,
    };

    for (const customerData of customers) {
      try {
        // Check if customer already exists by phone
        const existing = await this.prisma.customer.findFirst({
          where: { phone: customerData.phone },
        });

        if (existing) {
          results.errors.push({
            name: customerData.name,
            phone: customerData.phone,
            error: 'Customer with this phone already exists',
          });
          results.failed++;
          continue;
        }

        // Create customer
        const customer = await this.prisma.customer.create({
          data: {
            name: customerData.name,
            phone: customerData.phone,
            email: customerData.email,
            notes: customerData.notes,
          },
        });

        // If customer has initial credit amount, create a credit entry
        if (customerData.creditAmount && customerData.creditAmount > 0) {
          // Find any active machine (we need a machine ID for the entry)
          const machine = await this.prisma.machine.findFirst({
            where: { isActive: true },
          });

          if (machine) {
            // Create a past entry with credit amount to reflect historical credit
            await this.prisma.entry.create({
              data: {
                customerId: customer.id,
                machineId: machine.id,
                startTime: new Date(),
                endTime: new Date(),
                predefinedDuration: 0,
                duration: 0,
                cost: customerData.creditAmount,
                finalAmount: customerData.creditAmount,
                paymentType: 'credit',
                creditAmount: customerData.creditAmount,
                cashAmount: 0,
                onlineAmount: 0,
                paymentStatus: 'unpaid',
                notes: 'Initial credit from import',
              },
            });
          }
        }

        results.success++;
      } catch (error) {
        results.errors.push({
          name: customerData.name,
          phone: customerData.phone,
          error: error.message || 'Unknown error',
        });
        results.failed++;
      }
    }

    return results;
  }
}
