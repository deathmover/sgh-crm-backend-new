import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/database.config';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  async create(createExpenseDto: CreateExpenseDto, userId?: string) {
    return this.prisma.expense.create({
      data: {
        ...createExpenseDto,
        date: new Date(createExpenseDto.date),
        createdBy: userId,
      },
    });
  }

  async findAll(query: ExpenseQueryDto) {
    const where: any = {};

    if (query.category) {
      where.category = query.category;
    }

    if (query.paymentMode) {
      where.paymentMode = query.paymentMode;
    }

    if (query.startDate || query.endDate) {
      where.date = {};
      if (query.startDate) {
        const start = new Date(query.startDate);
        start.setHours(0, 0, 0, 0);
        where.date.gte = start;
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    return this.prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  async findOne(id: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
    });

    if (!expense) {
      throw new NotFoundException(`Expense with ID ${id} not found`);
    }

    return expense;
  }

  async update(id: string, updateExpenseDto: UpdateExpenseDto) {
    await this.findOne(id); // Check if exists

    return this.prisma.expense.update({
      where: { id },
      data: {
        ...updateExpenseDto,
        date: updateExpenseDto.date
          ? new Date(updateExpenseDto.date)
          : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Check if exists

    return this.prisma.expense.delete({
      where: { id },
    });
  }

  async getMonthlyTotal(year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const result = await this.prisma.expense.aggregate({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        amount: true,
      },
    });

    return result._sum.amount || 0;
  }

  async getCategoryBreakdown(startDate: string, endDate: string) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const expenses = await this.prisma.expense.groupBy({
      by: ['category'],
      where: {
        date: {
          gte: start,
          lte: end,
        },
      },
      _sum: {
        amount: true,
      },
      _count: true,
    });

    return expenses.map((e) => ({
      category: e.category,
      total: e._sum.amount || 0,
      count: e._count,
    }));
  }

  async getMonthlyTrend(months: number = 6) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const expenses = await this.prisma.expense.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        date: true,
        amount: true,
        category: true,
      },
    });

    // Group by month
    const monthlyData = new Map<string, number>();

    expenses.forEach((expense) => {
      const monthKey = expense.date.toISOString().substring(0, 7); // YYYY-MM
      monthlyData.set(
        monthKey,
        (monthlyData.get(monthKey) || 0) + expense.amount,
      );
    });

    return Array.from(monthlyData.entries())
      .map(([month, total]) => ({
        month,
        total,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }
}
