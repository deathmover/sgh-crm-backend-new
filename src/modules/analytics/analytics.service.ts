import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/database.config';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats(date?: string, startDate?: string, endDate?: string) {
    let dateFilter: any;
    let comparisonFilter: any;

    // If startDate and endDate provided, use range; otherwise use single date
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      dateFilter = {
        createdAt: {
          gte: start,
          lte: end,
        },
        isDeleted: false,
      };

      // Calculate comparison period (same duration before start date)
      const rangeDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const comparisonStart = new Date(start);
      comparisonStart.setDate(comparisonStart.getDate() - rangeDays);
      const comparisonEnd = new Date(start);
      comparisonEnd.setDate(comparisonEnd.getDate() - 1);
      comparisonEnd.setHours(23, 59, 59, 999);

      comparisonFilter = {
        createdAt: {
          gte: comparisonStart,
          lte: comparisonEnd,
        },
        isDeleted: false,
      };
    } else {
      // Single date mode (backward compatible)
      const targetDate = date ? new Date(date) : new Date();
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      dateFilter = {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        isDeleted: false,
      };

      // Yesterday's data for comparison
      const yesterdayStart = new Date(startOfDay);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const yesterdayEnd = new Date(endOfDay);
      yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
      comparisonFilter = {
        createdAt: {
          gte: yesterdayStart,
          lte: yesterdayEnd,
        },
        isDeleted: false,
      };
    }

    // Total revenue by payment type (today) - using split payment fields
    const [cashData, onlineData, creditData] = await Promise.all([
      this.prisma.entry.aggregate({
        where: {
          ...dateFilter,
          endTime: { not: null },
        },
        _sum: { cashAmount: true },
      }),
      this.prisma.entry.aggregate({
        where: {
          ...dateFilter,
          endTime: { not: null },
        },
        _sum: { onlineAmount: true },
      }),
      this.prisma.entry.aggregate({
        where: {
          ...dateFilter,
          endTime: { not: null },
        },
        _sum: { creditAmount: true },
      }),
    ]);

    const cashRevenue = cashData._sum.cashAmount || 0;
    const onlineRevenue = onlineData._sum.onlineAmount || 0;
    const creditRevenue = creditData._sum.creditAmount || 0;

    // Comparison revenue for growth calculation
    const [comparisonCash, comparisonOnline] = await Promise.all([
      this.prisma.entry.aggregate({
        where: {
          ...comparisonFilter,
          endTime: { not: null },
        },
        _sum: { cashAmount: true },
      }),
      this.prisma.entry.aggregate({
        where: {
          ...comparisonFilter,
          endTime: { not: null },
        },
        _sum: { onlineAmount: true },
      }),
    ]);

    const comparisonRevenue =
      (comparisonCash._sum.cashAmount || 0) +
      (comparisonOnline._sum.onlineAmount || 0);
    const currentRevenue = cashRevenue + onlineRevenue;
    const revenueGrowth =
      comparisonRevenue > 0
        ? ((currentRevenue - comparisonRevenue) / comparisonRevenue) * 100
        : 0;

    // Pending credit (all time) - sum of all customer pendingCredit
    const customers = await this.prisma.customer.findMany({
      select: { pendingCredit: true },
    });
    const totalPendingCredit = customers.reduce((sum, c) => sum + c.pendingCredit, 0);

    // Total sessions for selected period
    const currentSessions = await this.prisma.entry.count({
      where: dateFilter,
    });

    // Comparison sessions for growth calculation
    const comparisonSessions = await this.prisma.entry.count({
      where: comparisonFilter,
    });
    const sessionsGrowth =
      comparisonSessions > 0
        ? ((currentSessions - comparisonSessions) / comparisonSessions) * 100
        : 0;

    // Active sessions
    const activeSessions = await this.prisma.entry.count({
      where: {
        endTime: null,
        isDeleted: false,
      },
    });

    // Average session duration today
    const durationData = await this.prisma.entry.aggregate({
      where: {
        ...dateFilter,
        endTime: { not: null },
        duration: { not: null },
      },
      _avg: { duration: true },
      _count: true,
    });

    // Total unique customers today
    const uniqueCustomersToday = await this.prisma.entry.findMany({
      where: dateFilter,
      select: { customerId: true },
      distinct: ['customerId'],
    });

    return {
      todayRevenue: cashRevenue + onlineRevenue,
      todaySessions: currentSessions,
      pendingCredit: totalPendingCredit,
      activeSessions,
      revenueByPaymentType: {
        cash: cashRevenue,
        online: onlineRevenue,
        credit: creditRevenue,
      },
      revenueGrowth: parseFloat(revenueGrowth.toFixed(2)),
      sessionsGrowth: parseFloat(sessionsGrowth.toFixed(2)),
      averageSessionDuration: durationData._avg.duration || 0,
      uniqueCustomersToday: uniqueCustomersToday.length,
    };
  }

  async getMachineUsageStats(startDate?: string, endDate?: string) {
    const where: any = {
      endTime: { not: null },
    };

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const machineStats = await this.prisma.entry.groupBy({
      by: ['machineId'],
      where,
      _sum: {
        finalAmount: true,
        duration: true,
      },
      _count: true,
    });

    // Get machine details
    const machineIds = machineStats.map((stat) => stat.machineId);
    const machines = await this.prisma.machine.findMany({
      where: { id: { in: machineIds } },
      select: { id: true, name: true, type: true },
    });

    const machineMap = new Map<
      string,
      { id: string; name: string; type: string }
    >(machines.map((m) => [m.id, m]));

    return machineStats.map((stat) => {
      const machine = machineMap.get(stat.machineId);
      return {
        machineId: stat.machineId,
        machineName: machine?.name || 'Unknown',
        machineType: machine?.type || 'Unknown',
        totalSessions: stat._count,
        totalRevenue: stat._sum.finalAmount || 0,
        totalDuration: stat._sum.duration || 0,
      };
    });
  }

  async getWeeklyRevenueTrend() {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    const entries = await this.prisma.entry.findMany({
      where: {
        createdAt: {
          gte: sevenDaysAgo,
        },
        endTime: { not: null },
        isDeleted: false,
      },
      select: {
        createdAt: true,
        finalAmount: true,
        paymentType: true,
      },
    });

    // Group by date
    const revenueByDate = new Map<
      string,
      { cash: number; online: number; credit: number }
    >();

    entries.forEach((entry) => {
      const date = entry.createdAt.toISOString().split('T')[0];
      if (!revenueByDate.has(date)) {
        revenueByDate.set(date, { cash: 0, online: 0, credit: 0 });
      }
      const dateData = revenueByDate.get(date)!;
      if (entry.paymentType === 'cash') {
        dateData.cash += entry.finalAmount;
      } else if (entry.paymentType === 'online') {
        dateData.online += entry.finalAmount;
      } else if (entry.paymentType === 'credit') {
        dateData.credit += entry.finalAmount;
      }
    });

    // Convert to array and sort by date
    const trendData = Array.from(revenueByDate.entries())
      .map(([date, revenue]) => ({
        date,
        cashRevenue: revenue.cash,
        onlineRevenue: revenue.online,
        creditRevenue: revenue.credit,
        totalRevenue: revenue.cash + revenue.online + revenue.credit,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return trendData;
  }

  async getPaymentTypeBreakdown(startDate?: string, endDate?: string) {
    const where: any = {
      endTime: { not: null },
    };

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const paymentStats = await this.prisma.entry.groupBy({
      by: ['paymentType'],
      where,
      _sum: {
        finalAmount: true,
      },
      _count: true,
    });

    return paymentStats.map((stat) => ({
      paymentType: stat.paymentType,
      count: stat._count,
      totalAmount: stat._sum.finalAmount || 0,
    }));
  }

  async getTopCustomers(
    limit: number = 10,
    startDate?: string,
    endDate?: string,
  ) {
    const where: any = {
      endTime: { not: null },
      isDeleted: false,
    };

    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      where.createdAt = {
        gte: start,
        lte: end,
      };
    }

    const customerStats = await this.prisma.entry.groupBy({
      by: ['customerId'],
      where,
      _sum: {
        finalAmount: true,
      },
      _count: true,
      orderBy: {
        _sum: {
          finalAmount: 'desc',
        },
      },
      take: limit,
    });

    // Get customer details
    const customerIds = customerStats.map((stat) => stat.customerId);
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true, phone: true },
    });

    const customerMap = new Map<
      string,
      { id: string; name: string; phone: string | null }
    >(customers.map((c) => [c.id, c]));

    return customerStats.map((stat) => {
      const customer = customerMap.get(stat.customerId);
      return {
        customerId: stat.customerId,
        customerName: customer?.name || 'Unknown',
        customerPhone: customer?.phone || null,
        totalSessions: stat._count,
        totalSpent: stat._sum.finalAmount || 0,
      };
    });
  }

  async getRevenueReport(startDate: string, endDate: string) {
    const where = {
      createdAt: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
      endTime: { not: null },
      isDeleted: false,
    };

    const totalRevenue = await this.prisma.entry.aggregate({
      where,
      _sum: {
        finalAmount: true,
      },
      _count: true,
    });

    const paymentBreakdown = await this.getPaymentTypeBreakdown(
      startDate,
      endDate,
    );
    const machineUsage = await this.getMachineUsageStats(startDate, endDate);
    const topCustomers = await this.getTopCustomers(10, startDate, endDate);

    return {
      period: {
        startDate,
        endDate,
      },
      totalRevenue: totalRevenue._sum.finalAmount || 0,
      totalTransactions: totalRevenue._count,
      paymentBreakdown,
      machineUsage,
      topCustomers,
    };
  }

  async getPeakHours(date?: string, startDate?: string, endDate?: string) {
    let dateFilter: any;

    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      dateFilter = {
        createdAt: {
          gte: start,
          lte: end,
        },
      };
    } else {
      const targetDate = date ? new Date(date) : new Date();
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      dateFilter = {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      };
    }

    const entries = await this.prisma.entry.findMany({
      where: dateFilter,
      select: {
        startTime: true,
        finalAmount: true,
      },
    });

    // Group by hour
    const hourlyData = new Map<number, { sessions: number; revenue: number }>();

    for (let i = 0; i < 24; i++) {
      hourlyData.set(i, { sessions: 0, revenue: 0 });
    }

    entries.forEach((entry) => {
      // Convert to IST (UTC+5:30)
      const utcDate = new Date(entry.startTime);
      const istDate = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000));
      const hour = istDate.getUTCHours();
      const data = hourlyData.get(hour)!;
      data.sessions += 1;
      data.revenue += entry.finalAmount || 0;
    });

    return Array.from(hourlyData.entries())
      .map(([hour, data]) => ({
        hour,
        sessions: data.sessions,
        revenue: data.revenue,
      }))
      .filter((h) => h.sessions > 0);
  }

  async getMachineUtilization(date?: string, startDate?: string, endDate?: string) {
    let dateFilter: any;
    let totalDays = 1;

    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      dateFilter = {
        createdAt: {
          gte: start,
          lte: end,
        },
      };

      // Calculate total days for utilization rate
      totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    } else {
      const targetDate = date ? new Date(date) : new Date();
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      dateFilter = {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      };
      totalDays = 1;
    }

    // Get all machines
    const machines = await this.prisma.machine.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        units: true,
      },
    });

    // Get usage data for each machine
    const utilizationData = await Promise.all(
      machines.map(async (machine) => {
        const entries = await this.prisma.entry.findMany({
          where: {
            machineId: machine.id,
            ...dateFilter,
            endTime: { not: null },
          },
          select: {
            duration: true,
            finalAmount: true,
          },
        });

        const totalMinutes = entries.reduce(
          (sum, e) => sum + (e.duration || 0),
          0,
        );
        const totalRevenue = entries.reduce(
          (sum, e) => sum + (e.finalAmount || 0),
          0,
        );

        // Calculate utilization percentage (1440 minutes per day * totalDays * units)
        const availableMinutes = 1440 * totalDays * machine.units;
        const utilizationRate = (totalMinutes / availableMinutes) * 100;

        return {
          machineId: machine.id,
          machineName: machine.name,
          machineType: machine.type,
          units: machine.units,
          totalSessions: entries.length,
          totalMinutes,
          totalRevenue,
          utilizationRate: parseFloat(utilizationRate.toFixed(2)),
        };
      }),
    );

    return utilizationData.sort((a, b) => b.utilizationRate - a.utilizationRate);
  }

  async getFinancialAnalysis(startDate?: string, endDate?: string) {
    // Default to current month if no dates provided
    const now = new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate
      ? new Date(endDate)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0);

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const dateFilter = {
      createdAt: { gte: start, lte: end },
      isDeleted: false,
    };

    // CASH INFLOW - Revenue from entries
    const [cashInflow, onlineInflow] = await Promise.all([
      this.prisma.entry.aggregate({
        where: { ...dateFilter, endTime: { not: null } },
        _sum: { cashAmount: true },
      }),
      this.prisma.entry.aggregate({
        where: { ...dateFilter, endTime: { not: null } },
        _sum: { onlineAmount: true },
      }),
    ]);

    const totalInflow = (cashInflow._sum.cashAmount || 0) + (onlineInflow._sum.onlineAmount || 0);

    // CASH OUTFLOW - Expenses
    const expensesByCategory = await this.prisma.expense.groupBy({
      by: ['category'],
      where: {
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
    });

    const totalOutflow = expensesByCategory.reduce(
      (sum, cat) => sum + (cat._sum.amount || 0),
      0,
    );

    // Expense breakdown
    const expenseBreakdown = expensesByCategory.map((cat) => ({
      category: cat.category,
      amount: cat._sum.amount || 0,
    }));

    // NET PROFIT/LOSS
    const netProfitLoss = totalInflow - totalOutflow;
    const profitMargin =
      totalInflow > 0 ? (netProfitLoss / totalInflow) * 100 : 0;

    // PENDING CREDIT (Outstanding receivables) - sum from customers
    const allCustomers = await this.prisma.customer.findMany({
      select: { pendingCredit: true },
    });
    const outstandingReceivables = allCustomers.reduce((sum, c) => sum + c.pendingCredit, 0);

    // MONTHLY TREND (Last 6 months)
    const monthlyTrend: Array<{
      month: string;
      revenue: number;
      expenses: number;
      profit: number;
    }> = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      monthStart.setHours(0, 0, 0, 0);
      monthEnd.setHours(23, 59, 59, 999);

      const [monthRevenue, monthExpenses] = await Promise.all([
        this.prisma.entry.aggregate({
          where: {
            createdAt: { gte: monthStart, lte: monthEnd },
            endTime: { not: null },
            isDeleted: false,
          },
          _sum: { cashAmount: true, onlineAmount: true },
        }),
        this.prisma.expense.aggregate({
          where: {
            date: { gte: monthStart, lte: monthEnd },
          },
          _sum: { amount: true },
        }),
      ]);

      const revenue =
        (monthRevenue._sum.cashAmount || 0) +
        (monthRevenue._sum.onlineAmount || 0);
      const expenses = monthExpenses._sum.amount || 0;

      monthlyTrend.push({
        month: monthStart.toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        }),
        revenue,
        expenses,
        profit: revenue - expenses,
      });
    }

    // PAYMENT MODE BREAKDOWN
    const paymentModeBreakdown = await this.prisma.expense.groupBy({
      by: ['paymentMode'],
      where: {
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
    });

    return {
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      cashFlow: {
        totalInflow,
        cashInflow: cashInflow._sum.cashAmount || 0,
        onlineInflow: onlineInflow._sum.onlineAmount || 0,
        totalOutflow,
        netCashFlow: totalInflow - totalOutflow,
      },
      profitLoss: {
        revenue: totalInflow,
        expenses: totalOutflow,
        netProfitLoss,
        profitMargin: parseFloat(profitMargin.toFixed(2)),
      },
      expenseBreakdown,
      outstandingReceivables,
      monthlyTrend,
      expensePaymentModes: paymentModeBreakdown.map((pm) => ({
        mode: pm.paymentMode,
        amount: pm._sum.amount || 0,
      })),
    };
  }
}
