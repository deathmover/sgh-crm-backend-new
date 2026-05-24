import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../config/database.config';
import { CreateDailyBalanceDto } from './dto/create-daily-balance.dto';
import { UpdateDailyBalanceDto } from './dto/update-daily-balance.dto';

@Injectable()
export class DailyBalancesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateDailyBalanceDto) {
    const date = new Date(dto.date);
    date.setHours(0, 0, 0, 0);

    const existing = await this.prisma.dailyBalance.findUnique({ where: { date } });
    if (existing) throw new ConflictException('A daily balance record already exists for this date');

    return this.prisma.dailyBalance.create({
      data: { ...dto, date },
    });
  }

  async findAll(month?: number, year?: number) {
    const where: any = {};
    if (month && year) {
      where.date = {
        gte: new Date(year, month - 1, 1),
        lte: new Date(year, month, 0, 23, 59, 59, 999),
      };
    } else if (year) {
      where.date = {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 31, 23, 59, 59, 999),
      };
    }
    return this.prisma.dailyBalance.findMany({ where, orderBy: { date: 'asc' } });
  }

  async findOne(id: string) {
    const record = await this.prisma.dailyBalance.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Daily balance ${id} not found`);
    return record;
  }

  async getLastClosing() {
    return this.prisma.dailyBalance.findFirst({
      where: {
        cashClosing: { not: null },
      },
      orderBy: { date: 'desc' },
    });
  }

  async update(id: string, dto: UpdateDailyBalanceDto) {
    await this.findOne(id);
    const data: any = { ...dto };
    if (dto.date) {
      const date = new Date(dto.date);
      date.setHours(0, 0, 0, 0);
      data.date = date;
    }
    return this.prisma.dailyBalance.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.dailyBalance.delete({ where: { id } });
  }
}
