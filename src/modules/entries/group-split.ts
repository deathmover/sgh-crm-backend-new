/**
 * Splits whole rupees across items by weight (largest remainder), so the
 * parts always add up to the total exactly. Equal weights when all are 0.
 */
export function splitByWeight(total: number, weights: number[]): number[] {
  const n = weights.length;
  if (!n) return [];
  const w = weights.some((x) => x > 0) ? weights.map((x) => Math.max(0, x)) : weights.map(() => 1);
  const sum = w.reduce((a, b) => a + b, 0);
  const exact = w.map((x) => (total * x) / sum);
  const parts = exact.map(Math.floor);
  let left = total - parts.reduce((a, b) => a + b, 0);
  // Hand the leftover rupees to the biggest fractions; ties go to the earlier PC
  const order = exact.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % n, left--) parts[order[k].i]++;
  return parts;
}

export type AdvanceShare = { cashAmount: number; onlineAmount: number; creditAmount: number };

/**
 * One advance for the whole group, spread over its entries in proportion to
 * each bill (evenly when there is no bill yet). Each entry's share is filled
 * from cash first, then online, then credit, so every entry ends up with its
 * exact share and the three totals still match what was collected.
 */
export function splitAdvance(bills: number[], cash: number, online: number, credit: number): AdvanceShare[] {
  const shares = splitByWeight(cash + online + credit, bills);
  const pools = { cashAmount: cash, onlineAmount: online, creditAmount: credit };
  return shares.map((share) => {
    const out: AdvanceShare = { cashAmount: 0, onlineAmount: 0, creditAmount: 0 };
    let need = share;
    for (const key of ['cashAmount', 'onlineAmount', 'creditAmount'] as const) {
      const take = Math.min(need, pools[key]);
      out[key] = take;
      pools[key] -= take;
      need -= take;
    }
    return out;
  });
}
