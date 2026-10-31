import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/database.config';
import { dateRange, startOfLocalDay, toLocalDateKey } from '../../common/utils/date-range';
import { isControllerPriced, pricingBreakdown, type PricedMachine } from '../machines/pricing';
import { SettingsService } from '../settings/settings.module';
import { ReportsService } from './reports.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round(n * 100) / 100;
const pct = (part: number, whole: number) => (whole > 0 ? round2((part / whole) * 100) : 0);
/** Monday-first weekday index (0 = Mon … 6 = Sun) */
const weekdayIndex = (d: Date) => (d.getDay() + 6) % 7;
const daysBetween = (from: Date, to: Date) => Math.floor((startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime()) / DAY_MS);

/** Inclusive local-day range from YYYY-MM-DD strings; defaults to this month so far. */
function resolveRange(startDate?: string, endDate?: string) {
  const today = toLocalDateKey(new Date());
  const startKey = startDate || today.slice(0, 8) + '01';
  const endKey = endDate || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startKey) || !/^\d{4}-\d{2}-\d{2}$/.test(endKey) || startKey > endKey) {
    throw new BadRequestException('startDate and endDate must be YYYY-MM-DD with startDate <= endDate');
  }
  const range = dateRange(startKey, endKey);
  const days = Math.round((range.lte.getTime() - range.gte.getTime()) / DAY_MS);
  if (days > 400) throw new BadRequestException('Pick a range of at most 400 days');
  return { range, period: { startDate: startKey, endDate: endKey, days } };
}

/**
 * Owner-facing analysis built on the same money rules as the reports: a session
 * counts on the day it started, and its bill is finalAmount (snacks included).
 */
@Injectable()
export class InsightsService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private reports: ReportsService,
  ) {}

  /**
   * Regulars, lapsed customers, spend per visit and how many first-timers return.
   * A "visit" is a customer on a calendar day, however many sessions they played.
   */
  async customers(startDate?: string, endDate?: string) {
    const { range, period } = resolveRange(startDate, endDate);
    const now = new Date();

    const [entries, customers] = await Promise.all([
      this.prisma.entry.findMany({
        where: { isDeleted: false },
        select: { customerId: true, startTime: true, endTime: true, duration: true, finalAmount: true },
        orderBy: { startTime: 'asc' },
      }),
      this.prisma.customer.findMany({ select: { id: true, name: true, phone: true } }),
    ]);
    const info = new Map(customers.map((c) => [c.id, c]));

    type Row = { days: string[]; spend: number; rangeDays: Set<string>; rangeSpend: number; rangeHours: number; rangeSessions: number };
    const byCustomer = new Map<string, Row>();
    for (const e of entries) {
      const row = byCustomer.get(e.customerId) ?? { days: [], spend: 0, rangeDays: new Set(), rangeSpend: 0, rangeHours: 0, rangeSessions: 0 };
      const day = toLocalDateKey(e.startTime);
      if (row.days[row.days.length - 1] !== day) row.days.push(day); // entries are in time order
      const bill = e.endTime ? e.finalAmount : 0;
      row.spend += bill;
      if (e.startTime >= range.gte && e.startTime <= range.lte) {
        row.rangeDays.add(day);
        row.rangeSpend += bill;
        row.rangeHours += (e.duration || 0) / 60;
        row.rangeSessions += 1;
      }
      byCustomer.set(e.customerId, row);
    }

    const startKey = period.startDate;
    const endKey = period.endDate;
    const todayKey = toLocalDateKey(now);
    const active = [...byCustomer.entries()].filter(([, r]) => r.rangeDays.size > 0);
    const isNew = (r: Row) => r.days[0] >= startKey && r.days[0] <= endKey;
    const visits = active.reduce((s, [, r]) => s + r.rangeDays.size, 0);
    const spend = active.reduce((s, [, r]) => s + r.rangeSpend, 0);
    const newCustomers = active.filter(([, r]) => isNew(r)).length;

    // First-timers in the range: did they come back, and within 30 days?
    const cohort = active.filter(([, r]) => isNew(r));
    const addDays = (key: string, n: number) => toLocalDateKey(new Date(startOfLocalDay(key).getTime() + n * DAY_MS + DAY_MS / 2));
    const returnedSoFar = cohort.filter(([, r]) => r.days.length > 1).length;
    // Only people whose first visit is 30+ days old have had a fair chance to return
    const eligible = cohort.filter(([, r]) => addDays(r.days[0], 30) <= todayKey);
    const returnedWithin30 = eligible.filter(([, r]) => r.days.length > 1 && r.days[1] <= addDays(r.days[0], 30)).length;

    const frequency = [
      { label: '1 visit', min: 1, max: 1 },
      { label: '2–3 visits', min: 2, max: 3 },
      { label: '4–7 visits', min: 4, max: 7 },
      { label: '8+ visits', min: 8, max: Infinity },
    ].map((b) => ({ label: b.label, customers: active.filter(([, r]) => r.rangeDays.size >= b.min && r.rangeDays.size <= b.max).length }));

    const regulars = active
      .map(([id, r]) => ({
        id,
        name: info.get(id)?.name ?? 'Unknown',
        phone: info.get(id)?.phone ?? null,
        visits: r.rangeDays.size,
        sessions: r.rangeSessions,
        hours: round2(r.rangeHours),
        spend: r.rangeSpend,
        avgPerVisit: r.rangeDays.size ? Math.round(r.rangeSpend / r.rangeDays.size) : 0,
        lastVisit: r.days[r.days.length - 1],
        isNew: isNew(r),
      }))
      .sort((a, b) => b.visits - a.visits || b.spend - a.spend)
      .slice(0, 25);

    // Not seen for 30+ days (independent of the range): the win-back list
    const lapsedAll = [...byCustomer.entries()]
      .map(([id, r]) => ({ id, r, last: r.days[r.days.length - 1] }))
      .filter((x) => daysBetween(startOfLocalDay(x.last), now) >= 30);
    const lapsed = lapsedAll
      .map(({ id, r, last }) => ({
        id,
        name: info.get(id)?.name ?? 'Unknown',
        phone: info.get(id)?.phone ?? null,
        visits: r.days.length,
        lifetimeSpend: r.spend,
        lastVisit: last,
        daysAway: daysBetween(startOfLocalDay(last), now),
      }))
      .sort((a, b) => b.lifetimeSpend - a.lifetimeSpend)
      .slice(0, 50);

    return {
      period,
      summary: {
        customers: active.length,
        newCustomers,
        returningCustomers: active.length - newCustomers,
        visits,
        spend,
        avgSpendPerVisit: visits ? Math.round(spend / visits) : 0,
        avgVisitsPerCustomer: active.length ? round2(visits / active.length) : 0,
      },
      firstTimers: {
        count: cohort.length,
        returnedSoFar,
        returnedSoFarRate: pct(returnedSoFar, cohort.length),
        eligible: eligible.length,
        returnedWithin30,
        returnRate30: eligible.length ? pct(returnedWithin30, eligible.length) : null,
      },
      frequency,
      regulars,
      lapsed: {
        total: lapsedAll.length,
        regularsLost: lapsedAll.filter((x) => x.r.days.length >= 3).length,
        lifetimeSpend: lapsedAll.reduce((s, x) => s + x.r.spend, 0),
        customers: lapsed,
      },
    };
  }

  /** Minutes each machine was in use, by weekday and hour, to find dead and peak hours. */
  async occupancy(startDate?: string, endDate?: string) {
    const { range, period } = resolveRange(startDate, endDate);
    const now = new Date();
    const [machines, entries] = await Promise.all([
      this.prisma.machine.findMany({
        where: { isActive: true },
        select: { id: true, name: true, type: true, units: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.entry.findMany({
        where: { isDeleted: false, startTime: range },
        select: { machineId: true, startTime: true, endTime: true, duration: true },
      }),
    ]);

    const grid = new Map(machines.map((m) => [m.id, Array.from({ length: 7 }, () => new Array<number>(24).fill(0))]));
    for (const e of entries) {
      const cells = grid.get(e.machineId);
      if (!cells) continue;
      const start = e.startTime.getTime();
      const end = Math.min(
        e.endTime ? e.endTime.getTime() : e.duration ? start + e.duration * 60_000 : now.getTime(),
        range.lte.getTime(),
        now.getTime(),
      );
      // Walk hour by hour, crediting the minutes that fall in each slot
      for (let t = start; t < end; ) {
        const slot = new Date(t);
        const next = new Date(slot);
        next.setMinutes(0, 0, 0);
        next.setHours(next.getHours() + 1);
        const upto = Math.min(next.getTime(), end);
        cells[weekdayIndex(slot)][slot.getHours()] += (upto - t) / 60_000;
        t = upto;
      }
    }

    // How many Mondays, Tuesdays… the range has; capacity is units × days × 60 minutes
    const weekdayCounts = new Array<number>(7).fill(0);
    for (let t = range.gte.getTime(); t <= range.lte.getTime(); t += DAY_MS) weekdayCounts[weekdayIndex(new Date(t + DAY_MS / 2))] += 1;

    return {
      period,
      weekdayCounts,
      machines: machines.map((m) => {
        const minutes = grid.get(m.id)!.map((row) => row.map((v) => Math.round(v)));
        const used = minutes.flat().reduce((s, v) => s + v, 0);
        return { id: m.id, name: m.name, type: m.type, units: m.units, minutes, hoursUsed: round2(used / 60) };
      }),
    };
  }

  /**
   * Where session money comes from (hourly, packages, memberships), which
   * packages sell, and what discounts and below-rate bills cost, by login.
   * Package detection re-prices each session on the machine's current rate card.
   */
  async pricing(startDate?: string, endDate?: string) {
    const { range, period } = resolveRange(startDate, endDate);
    const entries = await this.prisma.entry.findMany({
      where: { isDeleted: false, startTime: range, endTime: { not: null } },
      select: {
        id: true,
        startTime: true,
        roundedDuration: true,
        duration: true,
        finalAmount: true,
        cost: true,
        discount: true,
        beveragesAmount: true,
        membershipId: true,
        billedBy: true,
        customer: { select: { name: true } },
        machine: { select: { name: true, type: true, hourlyRate: true, halfHourlyRate: true, packageRates: true, controllerRates: true } },
      },
      orderBy: { startTime: 'desc' },
    });

    const mix = {
      hourly: { sessions: 0, revenue: 0 },
      package: { sessions: 0, revenue: 0, customerSavings: 0 },
      membership: { sessions: 0, hours: 0 },
    };
    const packages = new Map<string, { machine: string; hours: number; price: number; sessions: number; revenue: number; customerSavings: number }>();
    const staff = new Map<string, { login: string; sessions: number; discountedSessions: number; discount: number; belowRate: number }>();
    const discounted: {
      id: string; date: string; customer: string; machine: string; bill: number; discount: number; belowRate: number; billedBy: string | null;
    }[] = [];
    let gross = 0;

    for (const e of entries) {
      const play = Math.max(0, e.finalAmount - e.beveragesAmount);
      if (e.membershipId) {
        mix.membership.sessions += 1;
        mix.membership.hours += (e.roundedDuration || e.duration || 0) / 60;
        continue;
      }

      const minutes = e.roundedDuration || 0;
      // Controller-priced machines (PS5) bill per controller with no packages
      const machine = e.machine as unknown as PricedMachine;
      const breakdown = minutes > 0 && !isControllerPriced(machine) ? pricingBreakdown(minutes, machine) : null;
      if (breakdown?.packageHours) {
        mix.package.sessions += 1;
        mix.package.revenue += play;
        mix.package.customerSavings += breakdown.hourlyCost - breakdown.cost;
        const key = `${e.machine.name}|${breakdown.packageHours}`;
        const price = Number((e.machine.packageRates as Record<string, number> | null)?.[String(breakdown.packageHours)] ?? 0);
        const row = packages.get(key) ?? { machine: e.machine.name, hours: breakdown.packageHours, price, sessions: 0, revenue: 0, customerSavings: 0 };
        row.sessions += 1;
        row.revenue += play;
        row.customerSavings += breakdown.hourlyCost - breakdown.cost;
        packages.set(key, row);
      } else {
        mix.hourly.sessions += 1;
        mix.hourly.revenue += play;
      }

      // Below rate card: the bill is less than play cost - discount + snacks.
      // Covers hand-edited amounts and extra time that was never billed.
      const discount = e.discount || 0;
      const expected = e.cost != null ? Math.max(0, e.cost - discount) + e.beveragesAmount : null;
      const belowRate = expected != null ? Math.max(0, expected - e.finalAmount) : 0;
      gross += (e.cost ?? play) + e.beveragesAmount;

      const login = e.billedBy || 'Not recorded';
      const s = staff.get(login) ?? { login, sessions: 0, discountedSessions: 0, discount: 0, belowRate: 0 };
      s.sessions += 1;
      s.discount += discount;
      s.belowRate += belowRate;
      if (discount + belowRate > 0) {
        s.discountedSessions += 1;
        discounted.push({
          id: e.id,
          date: e.startTime.toISOString(),
          customer: e.customer.name,
          machine: e.machine.name,
          bill: e.finalAmount,
          discount,
          belowRate,
          billedBy: e.billedBy,
        });
      }
      staff.set(login, s);
    }

    const totalDiscount = [...staff.values()].reduce((a, s) => a + s.discount, 0);
    const totalBelowRate = [...staff.values()].reduce((a, s) => a + s.belowRate, 0);
    const paidRevenue = mix.hourly.revenue + mix.package.revenue;

    return {
      period,
      mix: {
        hourly: { ...mix.hourly, share: pct(mix.hourly.revenue, paidRevenue) },
        package: { ...mix.package, share: pct(mix.package.revenue, paidRevenue) },
        membership: { sessions: mix.membership.sessions, hours: round2(mix.membership.hours) },
      },
      packages: [...packages.values()].sort((a, b) => b.sessions - a.sessions || b.revenue - a.revenue),
      discounts: {
        total: totalDiscount + totalBelowRate,
        discount: totalDiscount,
        belowRate: totalBelowRate,
        shareOfGross: pct(totalDiscount + totalBelowRate, gross),
        sessions: discounted.length,
        byLogin: [...staff.values()]
          .map((s) => ({ ...s, total: s.discount + s.belowRate }))
          .sort((a, b) => b.total - a.total),
        largest: discounted.sort((a, b) => b.discount + b.belowRate - (a.discount + a.belowRate)).slice(0, 15),
      },
    };
  }

  /** Who owes money and for how long, plus credit given vs collected per month. */
  async credit() {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const [owing, openingBalances, given, collected] = await Promise.all([
      this.prisma.entry.findMany({
        where: { isDeleted: false, creditAmount: { gt: 0 } },
        select: { customerId: true, startTime: true, creditAmount: true },
      }),
      this.prisma.customer.findMany({ where: { pendingCredit: { gt: 0 } }, select: { id: true, pendingCredit: true } }),
      this.prisma.entry.findMany({
        where: { isDeleted: false, startTime: { gte: sixMonthsAgo }, OR: [{ creditAmount: { gt: 0 } }, { creditPaid: { gt: 0 } }] },
        select: { startTime: true, creditAmount: true, creditPaid: true },
      }),
      this.prisma.creditPayment.findMany({ where: { createdAt: { gte: sixMonthsAgo } }, select: { createdAt: true, totalAmount: true } }),
    ]);

    type Debt = { id: string; d0_7: number; d8_30: number; d31: number; opening: number; oldest: Date | null };
    const debts = new Map<string, Debt>();
    const debt = (id: string) => {
      const d = debts.get(id) ?? { id, d0_7: 0, d8_30: 0, d31: 0, opening: 0, oldest: null };
      debts.set(id, d);
      return d;
    };
    for (const e of owing) {
      const d = debt(e.customerId);
      const age = daysBetween(e.startTime, now);
      if (age <= 7) d.d0_7 += e.creditAmount;
      else if (age <= 30) d.d8_30 += e.creditAmount;
      else d.d31 += e.creditAmount;
      if (!d.oldest || e.startTime < d.oldest) d.oldest = e.startTime;
    }
    // Opening balances (imported or typed in) have no session date
    for (const c of openingBalances) debt(c.id).opening += c.pendingCredit;

    const people = await this.prisma.customer.findMany({
      where: { id: { in: [...debts.keys()] } },
      select: { id: true, name: true, phone: true },
    });
    const info = new Map(people.map((p) => [p.id, p]));
    const customers = [...debts.values()]
      .map((d) => ({
        id: d.id,
        name: info.get(d.id)?.name ?? 'Unknown',
        phone: info.get(d.id)?.phone ?? null,
        total: round2(d.d0_7 + d.d8_30 + d.d31 + d.opening),
        d0_7: d.d0_7,
        d8_30: d.d8_30,
        d31: d.d31,
        opening: round2(d.opening),
        oldest: d.oldest ? toLocalDateKey(d.oldest) : null,
        daysOutstanding: d.oldest ? daysBetween(d.oldest, now) : null,
      }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.d31 - a.d31 || b.total - a.total);

    const sum = (k: 'd0_7' | 'd8_30' | 'd31' | 'opening') => round2(customers.reduce((s, c) => s + c[k], 0));
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + i, 1);
      return { month: toLocalDateKey(d).slice(0, 7), given: 0, collected: 0 };
    });
    const monthRow = (d: Date) => months.find((m) => m.month === toLocalDateKey(d).slice(0, 7));
    for (const e of given) {
      const m = monthRow(e.startTime);
      if (m) m.given += e.creditAmount + (e.creditPaid || 0);
    }
    for (const p of collected) {
      const m = monthRow(p.createdAt);
      if (m) m.collected += p.totalAmount;
    }
    const totalGiven = months.reduce((s, m) => s + m.given, 0);
    const totalCollected = months.reduce((s, m) => s + m.collected, 0);

    return {
      summary: {
        outstanding: round2(customers.reduce((s, c) => s + c.total, 0)),
        customers: customers.length,
        buckets: { d0_7: sum('d0_7'), d8_30: sum('d8_30'), d31: sum('d31'), opening: sum('opening') },
        collectedLast6Months: round2(totalCollected),
        givenLast6Months: round2(totalGiven),
        recoveryRate: pct(totalCollected, totalGiven),
      },
      monthly: months.map((m) => ({ ...m, collected: round2(m.collected) })),
      customers,
    };
  }

  /**
   * Memberships sold in the range: hours bought vs played, and what those hours
   * would have cost at walk-in rates (entry.cost is the rate-card price).
   */
  async memberships(startDate?: string, endDate?: string) {
    const { range, period } = resolveRange(startDate, endDate);
    const now = new Date();
    const [sold, machines] = await Promise.all([
      this.prisma.customerMembership.findMany({
        where: { purchaseDate: range, status: { not: 'cancelled' } },
        select: {
          paymentAmount: true,
          hoursTotal: true,
          hoursUsed: true,
          hoursRemaining: true,
          status: true,
          expiryDate: true,
          plan: { select: { id: true, name: true, price: true, hours: true, machineType: true } },
          entries: { where: { isDeleted: false }, select: { cost: true } },
        },
      }),
      this.prisma.machine.findMany({ where: { isActive: true }, select: { type: true, hourlyRate: true } }),
    ]);

    const walkIn = (type: string) => {
      const rates = machines.filter((m) => m.type === type).map((m) => m.hourlyRate);
      return rates.length ? Math.min(...rates) : null;
    };

    type PlanRow = {
      id: string; name: string; machineType: string; price: number; hours: number;
      sold: number; revenue: number; hoursSold: number; hoursUsed: number; valuePlayed: number; unusedExpiredHours: number; active: number;
      finishedRevenue: number; finishedHoursUsed: number;
    };
    const plans = new Map<string, PlanRow>();
    for (const m of sold) {
      const p = plans.get(m.plan.id) ?? {
        id: m.plan.id, name: m.plan.name, machineType: m.plan.machineType, price: m.plan.price, hours: m.plan.hours,
        sold: 0, revenue: 0, hoursSold: 0, hoursUsed: 0, valuePlayed: 0, unusedExpiredHours: 0, active: 0,
        finishedRevenue: 0, finishedHoursUsed: 0,
      };
      p.sold += 1;
      p.revenue += m.paymentAmount;
      p.hoursSold += m.hoursTotal;
      p.hoursUsed += m.hoursUsed;
      p.valuePlayed += m.entries.reduce((s, e) => s + (e.cost || 0), 0);
      const finished = m.status === 'expired' || m.status === 'exhausted' || m.expiryDate < now;
      if (finished) {
        p.unusedExpiredHours += m.hoursRemaining;
        p.finishedRevenue += m.paymentAmount;
        p.finishedHoursUsed += m.hoursUsed;
      } else p.active += 1;
      plans.set(m.plan.id, p);
    }

    const rows = [...plans.values()]
      .map((p) => {
        const { finishedRevenue, finishedHoursUsed, ...rest } = p;
        const rate = walkIn(p.machineType);
        const pricePerHour = p.hours > 0 ? p.price / p.hours : 0;
        // Only finished memberships show what an hour really earned: unused
        // hours raise it, a membership still running would look too good
        const earnedPerHour = finishedHoursUsed > 0 ? finishedRevenue / finishedHoursUsed : null;
        const perHour = earnedPerHour ?? pricePerHour;
        return {
          ...rest,
          hoursUsed: round2(p.hoursUsed),
          unusedExpiredHours: round2(p.unusedExpiredHours),
          usage: pct(p.hoursUsed, p.hoursSold),
          walkInRate: rate,
          pricePerHour: round2(pricePerHour),
          discountVsWalkIn: rate ? round2(((rate - pricePerHour) / rate) * 100) : null,
          earnedPerHour: earnedPerHour != null ? round2(earnedPerHour) : null,
          // Members pay under 70% of walk-in for each hour they play
          lowEarner: rate != null && perHour < rate * 0.7,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    const total = (k: 'revenue' | 'hoursSold' | 'hoursUsed' | 'valuePlayed' | 'unusedExpiredHours' | 'sold') =>
      round2(rows.reduce((s, r) => s + r[k], 0));
    return {
      period,
      summary: {
        sold: total('sold'),
        revenue: total('revenue'),
        hoursSold: total('hoursSold'),
        hoursUsed: total('hoursUsed'),
        usage: pct(total('hoursUsed'), total('hoursSold')),
        valuePlayed: total('valuePlayed'),
        unusedExpiredHours: total('unusedExpiredHours'),
      },
      plans: rows,
    };
  }

  /**
   * Progress against the monthly revenue goal (money received, as in the P&L)
   * and a forecast from the average of the days already finished.
   */
  async target() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const [settings, thisMonth, lastMonth] = await Promise.all([
      this.settings.get(),
      this.reports.profitLoss(year, month),
      this.reports.profitLoss(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1),
    ]);

    const todayKey = toLocalDateKey(now);
    const daysInMonth = thisMonth.daily.length;
    const dayOfMonth = now.getDate();
    const soFarDays = thisMonth.daily.filter((d) => d.date <= todayKey);
    const soFar = round2(soFarDays.reduce((s, d) => s + d.income, 0));
    const today = soFarDays.find((d) => d.date === todayKey)?.income ?? 0;
    // Today is still running, so project from finished days only
    const finishedDays = dayOfMonth - 1;
    const avgPerDay = finishedDays > 0 ? (soFar - today) / finishedDays : today;
    const forecast = round2(soFar + avgPerDay * (daysInMonth - dayOfMonth));
    const target = settings.monthlyTarget;
    const daysLeft = daysInMonth - dayOfMonth + 1; // including today

    let cumulative = 0;
    return {
      month: todayKey.slice(0, 7),
      target,
      soFar,
      today,
      dayOfMonth,
      daysInMonth,
      progress: target > 0 ? pct(soFar, target) : null,
      expectedByToday: target > 0 ? round2((target * dayOfMonth) / daysInMonth) : null,
      avgPerDay: round2(avgPerDay),
      forecast,
      forecastVsTarget: target > 0 ? pct(forecast, target) : null,
      neededPerDay: target > 0 ? round2(Math.max(0, target - soFar) / daysLeft) : null,
      lastMonth: lastMonth.summary.totalIncome,
      daily: thisMonth.daily.map((d) => {
        if (d.date <= todayKey) cumulative += d.income;
        return { date: d.date, income: d.income, cumulative: d.date <= todayKey ? round2(cumulative) : null };
      }),
    };
  }
}
