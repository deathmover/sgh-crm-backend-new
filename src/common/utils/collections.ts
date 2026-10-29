import type { PrismaClient } from '@prisma/client';

type Range = { gte: Date; lte: Date };

export interface OtherCollections {
  creditCash: number;
  creditOnline: number;
  membershipCash: number;
  membershipOnline: number;
  /** All non-session money received in the range, by mode */
  cash: number;
  online: number;
  total: number;
}

/**
 * Money received in a period that doesn't come from that period's sessions:
 * credit settled by customers (counted on the day it's paid, so it matches the
 * cash drawer) and membership sales (counted on the purchase date). Session
 * revenue (entry cash + online) is added separately by the callers.
 */
export async function getOtherCollections(prisma: PrismaClient, range: Range): Promise<OtherCollections> {
  const [credit, memberships] = await Promise.all([
    prisma.creditPayment.aggregate({
      // Older payments were added onto the original entries, so they're already
      // inside those days' session totals
      where: { createdAt: range, addedToEntryTotals: false },
      _sum: { cashAmount: true, onlineAmount: true },
    }),
    prisma.customerMembership.groupBy({
      by: ['paymentMode'],
      // Cancelled memberships are treated as refunded
      where: { purchaseDate: range, status: { not: 'cancelled' } },
      _sum: { paymentAmount: true },
    }),
  ]);

  const creditCash = credit._sum.cashAmount || 0;
  const creditOnline = credit._sum.onlineAmount || 0;
  let membershipCash = 0;
  let membershipOnline = 0;
  for (const row of memberships) {
    const amount = row._sum.paymentAmount || 0;
    if (row.paymentMode === 'cash') membershipCash += amount;
    else membershipOnline += amount;
  }

  const cash = creditCash + membershipCash;
  const online = creditOnline + membershipOnline;
  return { creditCash, creditOnline, membershipCash, membershipOnline, cash, online, total: cash + online };
}
