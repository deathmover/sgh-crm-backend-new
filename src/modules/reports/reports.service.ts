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
      // Snacks are part of the session bill, so they count on the day the session
      // started (like its money). createdAt moves whenever the bill is edited.
      this.prisma.entryItem.findMany({
        where: { entry: { isDeleted: false, startTime: range } },
        select: { name: true, quantity: true, total: true, unitCost: true, entry: { select: { startTime: true } } },
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
    for (const i of items) day(i.entry.startTime).snackSales += i.total;

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

  /**
   * Snacks & drinks analytics for a date range (inclusive, local days), dated by
   * session start like every other money figure. Compares with the same-length
   * period just before it.
   */
  async snacks(startDate?: string, endDate?: string) {
    const today = toLocalDateKey(new Date());
    const startKey = startDate || today.slice(0, 8) + '01';
    const endKey = endDate || today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startKey) || !/^\d{4}-\d{2}-\d{2}$/.test(endKey) || startKey > endKey) {
      throw new BadRequestException('startDate and endDate must be YYYY-MM-DD with startDate <= endDate');
    }
    const range = dateRange(startKey, endKey);
    const dayMs = 24 * 60 * 60 * 1000;
    const days = Math.round((range.lte.getTime() - range.gte.getTime()) / dayMs);
    if (days > 400) throw new BadRequestException('Pick a range of at most 400 days');
    const prevRange = { gte: new Date(range.gte.getTime() - days * dayMs), lte: new Date(range.gte.getTime() - 1) };

    const itemSelect = {
      productId: true,
      name: true,
      quantity: true,
      total: true,
      unitCost: true,
      entryId: true,
      product: { select: { category: true } },
      entry: { select: { startTime: true, machine: { select: { name: true } } } },
    } as const;

    const [items, prevItems, entries, prevEntryCount, products, losses, restocks] = await Promise.all([
      this.prisma.entryItem.findMany({ where: { entry: { isDeleted: false, startTime: range } }, select: itemSelect }),
      this.prisma.entryItem.findMany({
        where: { entry: { isDeleted: false, startTime: prevRange } },
        select: { quantity: true, total: true, unitCost: true, entryId: true },
      }),
      this.prisma.entry.findMany({
        where: { isDeleted: false, startTime: range },
        select: { id: true, finalAmount: true, machine: { select: { name: true } } },
      }),
      this.prisma.entry.count({ where: { isDeleted: false, startTime: prevRange } }),
      this.prisma.product.findMany({
        where: { isActive: true },
        select: { id: true, name: true, category: true, stock: true, lowStockLevel: true, costPrice: true, price: true, createdAt: true },
      }),
      this.prisma.stockMovement.findMany({
        where: { reason: 'adjust', change: { lt: 0 }, createdAt: range },
        select: { change: true, product: { select: { name: true, costPrice: true } } },
      }),
      this.prisma.stockMovement.findMany({
        where: { reason: 'restock', change: { gt: 0 }, createdAt: range },
        select: { change: true, product: { select: { costPrice: true } } },
      }),
    ]);

    const totals = (rows: { quantity: number; total: number; unitCost: number | null; entryId: string }[], sessionCount: number) => {
      const revenue = rows.reduce((a, i) => a + i.total, 0);
      const cost = rows.reduce((a, i) => a + (i.unitCost ?? 0) * i.quantity, 0);
      const snackSessions = new Set(rows.map((i) => i.entryId)).size;
      return {
        revenue,
        cost,
        // Same rule as the day summary and P&L: an unknown cost counts as 0, and
        // uncostedRevenue tells the UI how much of the profit that might overstate
        profit: revenue - cost,
        margin: revenue > 0 ? round2(((revenue - cost) / revenue) * 100) : null,
        uncostedRevenue: rows.filter((i) => i.unitCost == null).reduce((a, i) => a + i.total, 0),
        itemsSold: rows.reduce((a, i) => a + i.quantity, 0),
        sessions: sessionCount,
        snackSessions,
        attachRate: sessionCount > 0 ? round2((snackSessions / sessionCount) * 100) : 0,
        avgPerSnackSession: snackSessions > 0 ? round2(revenue / snackSessions) : 0,
      };
    };
    const summary = totals(items, entries.length);
    const previous = totals(prevItems, prevEntryCount);
    const sessionRevenue = entries.reduce((a, e) => a + e.finalAmount, 0);

    // Day by day (every day in range, zero-filled)
    const daily = new Map<string, { date: string; revenue: number; profit: number; quantity: number }>();
    for (let t = range.gte.getTime(); t <= range.lte.getTime(); t += dayMs) {
      const key = toLocalDateKey(new Date(t));
      daily.set(key, { date: key, revenue: 0, profit: 0, quantity: 0 });
    }
    const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, quantity: 0, revenue: 0 }));
    const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekday = WEEKDAYS.map((day) => ({ day, quantity: 0, revenue: 0, days: 0 }));
    for (const key of daily.keys()) weekday[new Date(`${key}T12:00:00`).getDay()].days += 1;

    type ItemRow = { productId: string | null; name: string; category: string; quantity: number; revenue: number; cost: number; costed: boolean };
    const byItem = new Map<string, ItemRow>();
    const byCategory = new Map<string, { category: string; quantity: number; revenue: number }>();
    const machineSnacks = new Map<string, { revenue: number; sessions: Set<string> }>();

    for (const i of items) {
      const start = i.entry.startTime;
      const lineCost = i.unitCost != null ? i.unitCost * i.quantity : 0;
      const d = daily.get(toLocalDateKey(start));
      if (d) {
        d.revenue += i.total;
        d.quantity += i.quantity;
        d.profit += i.total - lineCost;
      }
      hourly[start.getHours()].quantity += i.quantity;
      hourly[start.getHours()].revenue += i.total;
      weekday[start.getDay()].quantity += i.quantity;
      weekday[start.getDay()].revenue += i.total;

      const category = i.product?.category ?? 'other';
      const key = i.productId ?? `other:${i.name}`;
      const row = byItem.get(key) ?? { productId: i.productId, name: i.name, category, quantity: 0, revenue: 0, cost: 0, costed: true };
      row.quantity += i.quantity;
      row.revenue += i.total;
      row.cost += lineCost;
      if (i.unitCost == null) row.costed = false;
      byItem.set(key, row);

      const c = byCategory.get(category) ?? { category, quantity: 0, revenue: 0 };
      c.quantity += i.quantity;
      c.revenue += i.total;
      byCategory.set(category, c);

      const m = machineSnacks.get(i.entry.machine.name) ?? { revenue: 0, sessions: new Set<string>() };
      m.revenue += i.total;
      m.sessions.add(i.entryId);
      machineSnacks.set(i.entry.machine.name, m);
    }

    const sessionsPerMachine = new Map<string, number>();
    for (const e of entries) sessionsPerMachine.set(e.machine.name, (sessionsPerMachine.get(e.machine.name) || 0) + 1);
    const machines = [...sessionsPerMachine.entries()]
      .map(([name, sessions]) => {
        const m = machineSnacks.get(name);
        const snackSessions = m?.sessions.size ?? 0;
        return {
          name,
          sessions,
          snackSessions,
          attachRate: sessions ? round2((snackSessions / sessions) * 100) : 0,
          revenue: m?.revenue ?? 0,
          perSession: sessions ? round2((m?.revenue ?? 0) / sessions) : 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    // Stock cover uses the average daily sales over the selected range
    const soldByProduct = new Map<string, number>();
    for (const r of byItem.values()) if (r.productId) soldByProduct.set(r.productId, r.quantity);
    const itemRows = [...byItem.values()]
      .map((r) => {
        const product = r.productId ? products.find((p) => p.id === r.productId) : undefined;
        const perDay = r.quantity / days;
        return {
          productId: r.productId,
          name: r.name,
          category: r.category,
          quantity: r.quantity,
          revenue: r.revenue,
          cost: r.costed ? r.cost : null,
          profit: r.costed ? r.revenue - r.cost : null,
          margin: r.costed && r.revenue > 0 ? round2(((r.revenue - r.cost) / r.revenue) * 100) : null,
          share: summary.revenue > 0 ? round2((r.revenue / summary.revenue) * 100) : 0,
          stock: product?.stock ?? null,
          daysOfStock: product && perDay > 0 ? round2(Math.max(product.stock, 0) / perDay) : null,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    const runningOut = products
      .map((p) => {
        const perDay = (soldByProduct.get(p.id) || 0) / days;
        return { name: p.name, stock: p.stock, perDay: round2(perDay), daysLeft: perDay > 0 ? round2(Math.max(p.stock, 0) / perDay) : null };
      })
      .filter((p) => p.daysLeft != null && p.daysLeft <= 7)
      .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));

    // On the menu (and around for the whole range) but nothing sold
    const notSelling = products
      .filter((p) => !soldByProduct.has(p.id) && p.createdAt <= range.gte)
      .map((p) => ({ name: p.name, stock: p.stock, stockValue: p.stock > 0 ? p.stock * (p.costPrice ?? 0) : 0 }))
      .sort((a, b) => b.stockValue - a.stockValue);

    const lossQty = losses.reduce((a, l) => a - l.change, 0);
    const lossValue = losses.reduce((a, l) => a - l.change * (l.product.costPrice ?? 0), 0);
    const lossByItem = new Map<string, number>();
    for (const l of losses) lossByItem.set(l.product.name, (lossByItem.get(l.product.name) || 0) - l.change);

    return {
      period: { startDate: startKey, endDate: endKey, days },
      summary: { ...summary, shareOfSessionRevenue: sessionRevenue > 0 ? round2((summary.revenue / sessionRevenue) * 100) : 0 },
      previous: {
        startDate: toLocalDateKey(prevRange.gte),
        endDate: toLocalDateKey(prevRange.lte),
        revenue: previous.revenue,
        profit: previous.profit,
        itemsSold: previous.itemsSold,
        attachRate: previous.attachRate,
        avgPerSnackSession: previous.avgPerSnackSession,
      },
      daily: [...daily.values()],
      hourly,
      weekday: [...weekday.slice(1), weekday[0]].map((w) => ({
        day: w.day,
        quantity: w.quantity,
        revenue: w.revenue,
        avgRevenue: w.days ? round2(w.revenue / w.days) : 0,
      })),
      categories: [...byCategory.values()]
        .map((c) => ({ ...c, share: summary.revenue > 0 ? round2((c.revenue / summary.revenue) * 100) : 0 }))
        .sort((a, b) => b.revenue - a.revenue),
      items: itemRows,
      machines,
      stock: {
        runningOut,
        notSelling,
        losses: {
          quantity: lossQty,
          value: lossValue,
          items: [...lossByItem.entries()].map(([name, quantity]) => ({ name, quantity })).sort((a, b) => b.quantity - a.quantity),
        },
        restocked: {
          quantity: restocks.reduce((a, r) => a + r.change, 0),
          value: restocks.reduce((a, r) => a + r.change * (r.product.costPrice ?? 0), 0),
        },
      },
    };
  }
}
