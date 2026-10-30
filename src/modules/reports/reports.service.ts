import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/database.config';
import { dateRange, dayRange, toLocalDateKey } from '../../common/utils/date-range';
import { getOtherCollections } from '../../common/utils/collections';
import { SettingsService } from '../settings/settings.module';

type Range = { gte: Date; lte: Date };

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Money is counted the same way as the daily sheet: session cash/online by the
 * day the session started, credit collected on the day it was paid, membership
 * sales on the purchase date. Expenses by their date.
 */
@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {}

  private async loadPeriod(range: Range) {
    const [entries, creditPayments, memberships, expenses, items] = await Promise.all([
      this.prisma.entry.findMany({
        where: { startTime: range, isDeleted: false },
        select: {
          id: true,
          customerId: true,
          startTime: true,
          endTime: true,
          duration: true,
          finalAmount: true,
          cashAmount: true,
          onlineAmount: true,
          creditAmount: true,
          creditPaid: true,
          autoEnded: true,
          machine: { select: { id: true, name: true } },
        },
      }),
      this.prisma.creditPayment.findMany({
        where: { createdAt: range, addedToEntryTotals: false },
        select: { cashAmount: true, onlineAmount: true, totalAmount: true, createdAt: true },
      }),
      this.prisma.customerMembership.findMany({
        where: { purchaseDate: range, status: { not: 'cancelled' } },
        select: { paymentAmount: true, paymentMode: true, purchaseDate: true },
      }),
      this.prisma.expense.findMany({
        where: { date: range },
        orderBy: { date: 'asc' },
        select: { date: true, category: true, description: true, paymentMode: true, amount: true },
      }),
      this.prisma.entryItem.findMany({
        where: { createdAt: range, entry: { isDeleted: false } },
        select: { name: true, quantity: true, total: true, unitCost: true, createdAt: true },
      }),
    ]);
    return { entries, creditPayments, memberships, expenses, items };
  }

  private summarizeItems(items: { name: string; quantity: number; total: number; unitCost: number | null }[]) {
    const byName = new Map<string, { name: string; quantity: number; revenue: number; cost: number }>();
    for (const i of items) {
      const row = byName.get(i.name) ?? { name: i.name, quantity: 0, revenue: 0, cost: 0 };
      row.quantity += i.quantity;
      row.revenue += i.total;
      row.cost += (i.unitCost ?? 0) * i.quantity;
      byName.set(i.name, row);
    }
    const rows = [...byName.values()]
      .map((r) => ({ ...r, profit: r.revenue - r.cost }))
      .sort((a, b) => b.revenue - a.revenue);
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    const cost = rows.reduce((s, r) => s + r.cost, 0);
    return { rows, revenue, cost, profit: revenue - cost, quantity: rows.reduce((s, r) => s + r.quantity, 0) };
  }

  private summarizeMachines(entries: Awaited<ReturnType<ReportsService['loadPeriod']>>['entries']) {
    const byMachine = new Map<string, { name: string; sessions: number; hours: number; revenue: number }>();
    for (const e of entries) {
      const row = byMachine.get(e.machine.id) ?? { name: e.machine.name, sessions: 0, hours: 0, revenue: 0 };
      row.sessions += 1;
      row.hours += (e.duration || 0) / 60;
      row.revenue += e.endTime ? e.finalAmount : 0;
      byMachine.set(e.machine.id, row);
    }
    return [...byMachine.values()].map((r) => ({ ...r, hours: round2(r.hours) })).sort((a, b) => b.revenue - a.revenue);
  }

  async dailySummary(date?: string) {
    const range = dayRange(date || undefined);
    const [{ entries, expenses, items }, other, settings, lowStock, outstanding] = await Promise.all([
      this.loadPeriod(range),
      getOtherCollections(this.prisma, range),
      this.settings.get(),
      this.prisma.product.findMany({ where: { isActive: true }, orderBy: { stock: 'asc' } }),
      Promise.all([
        this.prisma.customer.aggregate({ _sum: { pendingCredit: true } }),
        this.prisma.entry.aggregate({ where: { isDeleted: false, creditAmount: { gt: 0 } }, _sum: { creditAmount: true } }),
      ]),
    ]);

    const ended = entries.filter((e) => e.endTime);
    const sessionCash = ended.reduce((s, e) => s + e.cashAmount, 0);
    const sessionOnline = ended.reduce((s, e) => s + e.onlineAmount, 0);
    const creditGiven = ended.reduce((s, e) => s + e.creditAmount + (e.creditPaid || 0), 0);
    const totalCash = sessionCash + other.cash;
    const totalOnline = sessionOnline + other.online;
    const totalIncome = totalCash + totalOnline;
    const expenseTotal = expenses.reduce((s, x) => s + x.amount, 0);
    const cashExpenses = expenses.filter((x) => x.paymentMode === 'cash').reduce((s, x) => s + x.amount, 0);

    const expenseByCategory = new Map<string, number>();
    for (const x of expenses) expenseByCategory.set(x.category, (expenseByCategory.get(x.category) || 0) + x.amount);

    const snacks = this.summarizeItems(items);

    return {
      date: toLocalDateKey(range.gte),
      cafeName: settings.cafeName,
      ownerWhatsapp: settings.ownerWhatsapp,
      generatedAt: new Date().toISOString(),
      sessions: {
        total: entries.length,
        ended: ended.length,
        stillPlaying: entries.length - ended.length,
        autoEnded: ended.filter((e) => e.autoEnded).length,
        uniqueCustomers: new Set(entries.map((e) => e.customerId)).size,
        hoursPlayed: round2(ended.reduce((s, e) => s + (e.duration || 0), 0) / 60),
      },
      income: {
        sessionCash,
        sessionOnline,
        creditCollectedCash: other.creditCash,
        creditCollectedOnline: other.creditOnline,
        membershipCash: other.membershipCash,
        membershipOnline: other.membershipOnline,
        totalCash,
        totalOnline,
        total: totalIncome,
        creditGiven,
      },
      expenses: {
        total: round2(expenseTotal),
        cash: round2(cashExpenses),
        byCategory: [...expenseByCategory.entries()].map(([category, amount]) => ({ category, amount: round2(amount) })),
      },
      net: round2(totalIncome - expenseTotal),
      // What should be in the drawer from today's activity (excludes opening balance)
      expectedCashFromToday: round2(totalCash - cashExpenses),
      snacks: {
        itemsSold: snacks.quantity,
        revenue: snacks.revenue,
        profit: snacks.profit,
        top: snacks.rows.slice(0, 5).map(({ name, quantity, revenue }) => ({ name, quantity, revenue })),
      },
      machines: this.summarizeMachines(entries).slice(0, 5),
      lowStock: lowStock
        .filter((p) => p.stock <= p.lowStockLevel)
        .map((p) => ({ name: p.name, stock: p.stock, lowStockLevel: p.lowStockLevel })),
      outstandingCredit: (outstanding[0]._sum.pendingCredit || 0) + (outstanding[1]._sum.creditAmount || 0),
    };
  }

  async profitLoss(year: number, month: number) {
    if (!(year >= 2000 && year <= 2100 && month >= 1 && month <= 12)) {
      throw new BadRequestException('Provide year and month (1–12)');
    }
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    const range = dateRange(start, end);
    const { entries, creditPayments, memberships, expenses, items } = await this.loadPeriod(range);
    const settings = await this.settings.get();

    // One row per calendar day
    const days = new Map<string, {
      date: string; sessions: number; hours: number; sessionCash: number; sessionOnline: number;
      creditCollected: number; membershipSales: number; snackSales: number; expenses: number; creditGiven: number;
    }>();
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = toLocalDateKey(d);
      days.set(key, { date: key, sessions: 0, hours: 0, sessionCash: 0, sessionOnline: 0, creditCollected: 0, membershipSales: 0, snackSales: 0, expenses: 0, creditGiven: 0 });
    }
    const day = (date: Date) => days.get(toLocalDateKey(date))!;

    for (const e of entries) {
      const row = day(e.startTime);
      row.sessions += 1;
      if (!e.endTime) continue;
      row.hours += (e.duration || 0) / 60;
      row.sessionCash += e.cashAmount;
      row.sessionOnline += e.onlineAmount;
      row.creditGiven += e.creditAmount + (e.creditPaid || 0);
    }
    for (const p of creditPayments) day(p.createdAt).creditCollected += p.totalAmount;
    for (const m of memberships) day(m.purchaseDate).membershipSales += m.paymentAmount;
    for (const x of expenses) day(x.date).expenses += x.amount;
    for (const i of items) day(i.createdAt).snackSales += i.total;

    const daily = [...days.values()].map((r) => {
      const income = r.sessionCash + r.sessionOnline + r.creditCollected + r.membershipSales;
      return { ...r, hours: round2(r.hours), expenses: round2(r.expenses), income: round2(income), net: round2(income - r.expenses) };
    });

    const sum = (key: keyof (typeof daily)[number]) => round2(daily.reduce((s, r) => s + (r[key] as number), 0));
    const sessionCash = sum('sessionCash');
    const sessionOnline = sum('sessionOnline');
    const creditCollectedCash = creditPayments.reduce((s, p) => s + p.cashAmount, 0);
    const membershipCash = memberships.filter((m) => m.paymentMode === 'cash').reduce((s, m) => s + m.paymentAmount, 0);
    const totalIncome = sum('income');
    const totalExpenses = sum('expenses');
    const snacks = this.summarizeItems(items);

    const byCategory = new Map<string, { category: string; amount: number; count: number }>();
    for (const x of expenses) {
      const row = byCategory.get(x.category) ?? { category: x.category, amount: 0, count: 0 };
      row.amount += x.amount;
      row.count += 1;
      byCategory.set(x.category, row);
    }

    return {
      cafeName: settings.cafeName,
      period: { year, month, startDate: toLocalDateKey(start), endDate: toLocalDateKey(end) },
      summary: {
        sessions: sum('sessions'),
        hoursPlayed: sum('hours'),
        sessionRevenue: round2(sessionCash + sessionOnline),
        creditCollected: sum('creditCollected'),
        membershipSales: sum('membershipSales'),
        totalIncome,
        cashIncome: round2(sessionCash + creditCollectedCash + membershipCash),
        onlineIncome: round2(totalIncome - (sessionCash + creditCollectedCash + membershipCash)),
        totalExpenses,
        netProfit: round2(totalIncome - totalExpenses),
        profitMargin: totalIncome > 0 ? round2(((totalIncome - totalExpenses) / totalIncome) * 100) : 0,
        creditGiven: sum('creditGiven'),
        snackRevenue: snacks.revenue,
        snackCost: snacks.cost,
        snackProfit: snacks.profit,
      },
      daily,
      expensesByCategory: [...byCategory.values()].map((r) => ({ ...r, amount: round2(r.amount) })).sort((a, b) => b.amount - a.amount),
      expenses: expenses.map((x) => ({ ...x, date: toLocalDateKey(x.date), amount: round2(x.amount) })),
      snacks: snacks.rows,
      machines: this.summarizeMachines(entries),
    };
  }
}

