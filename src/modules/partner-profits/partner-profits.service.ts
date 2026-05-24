import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/database.config';
import { CreatePartnerProfitDto } from './dto/create-partner-profit.dto';
import { UpdatePartnerProfitDto } from './dto/update-partner-profit.dto';

@Injectable()
export class PartnerProfitsService {
  constructor(private prisma: PrismaService) {}

  async upsert(dto: CreatePartnerProfitDto) {
    const { month, year, partnerName, amount, notes } = dto;
    return this.prisma.partnerProfit.upsert({
      where: { month_year_partnerName: { month, year, partnerName } },
      create: { month, year, partnerName, amount, notes },
      update: { amount, notes },
    });
  }

  async findByMonth(month: number, year: number) {
    return this.prisma.partnerProfit.findMany({
      where: { month, year },
      orderBy: { partnerName: 'asc' },
    });
  }

  async findAll(year?: number) {
    const where: any = year ? { year } : {};
    return this.prisma.partnerProfit.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { partnerName: 'asc' }],
    });
  }

  async update(id: string, dto: UpdatePartnerProfitDto) {
    const existing = await this.prisma.partnerProfit.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Partner profit ${id} not found`);
    return this.prisma.partnerProfit.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const existing = await this.prisma.partnerProfit.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Partner profit ${id} not found`);
    return this.prisma.partnerProfit.delete({ where: { id } });
  }
}
