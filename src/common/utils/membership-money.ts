/**
 * Cash and online parts of a membership payment. Memberships sold before split
 * payments have no parts saved, so their whole amount goes to their one mode.
 */
export function membershipSplit(m: {
  paymentAmount: number;
  paymentMode: string;
  cashAmount?: number | null;
  onlineAmount?: number | null;
}): { cash: number; online: number } {
  if (m.cashAmount != null || m.onlineAmount != null) {
    return { cash: m.cashAmount ?? 0, online: m.onlineAmount ?? 0 };
  }
  return m.paymentMode === 'online' ? { cash: 0, online: m.paymentAmount } : { cash: m.paymentAmount, online: 0 };
}
