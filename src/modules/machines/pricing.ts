/**
 * Session pricing. Keep in sync with sgh-crm-frontend/lib/utils/calculations.ts,
 * which runs the same rules to show the estimate before a session is saved.
 */

export interface RateCard {
  hourlyRate: number;
  halfHourlyRate?: number | null;
  /** { "3": 130, "5": 200 } — hours as keys */
  packageRates?: Record<string, number> | null;
}

/** Hourly (and optional half-hour) price for N controllers, e.g. { "2": { hourly: 180 } } */
export type ControllerRates = Record<string, { hourly: number; halfHourly?: number | null }>;

export interface PricedMachine extends RateCard {
  type: string;
  controllerRates?: ControllerRates | null;
}

/** Price for a duration already rounded to 30-minute blocks, from one rate card. */
export function costFromRates(minutes: number, rates: RateCard): number {
  if (minutes <= 0) return 0;
  const { hourlyRate, halfHourlyRate } = rates;

  const timeCost = (mins: number) => {
    if (mins <= 0) return 0;
    if (!halfHourlyRate) return Math.ceil(mins / 60) * hourlyRate;
    if (mins <= 30) return halfHourlyRate;
    const fullHours = Math.floor(mins / 60);
    const rest = mins % 60;
    // Exactly 30 minutes left uses the half-hour rate; anything else is a full hour
    return fullHours * hourlyRate + (rest === 30 ? halfHourlyRate : rest > 0 ? hourlyRate : 0);
  };

  // Use the largest package that fits (only one), then time-based for the rest.
  // Keys are parsed leniently: the settings screen used to store "2 hours",
  // which Number() turned into NaN so those packages never applied.
  const packages = Object.entries(rates.packageRates ?? {})
    .map(([key, price]) => ({ hours: parseFloat(key), price: Number(price) }))
    .filter((p) => p.hours > 0 && Number.isFinite(p.price))
    .sort((a, b) => b.hours - a.hours);
  const pkg = packages.find((p) => minutes / 60 >= p.hours);
  if (pkg) return pkg.price + timeCost(minutes - pkg.hours * 60);

  return timeCost(minutes);
}

export function controllerCount(pcNumber?: string | null): number {
  const n = parseInt(pcNumber || '1', 10);
  return n > 0 ? n : 1;
}

/** Machines billed by number of controllers (PCNumber field holds the count). */
export function isControllerPriced(machine: Pick<PricedMachine, 'type' | 'controllerRates'>): boolean {
  return machine.type === 'ps5' || Object.keys(machine.controllerRates ?? {}).length > 0;
}

/**
 * Full play cost for a session. Controller-priced machines use the café's own
 * per-controller table (e.g. 1 → ₹100, 2 → ₹180, 3 → ₹240, 4 → ₹280); a count
 * missing from the table falls back to the base rate × controllers.
 */
export function sessionCost(machine: PricedMachine, roundedMinutes: number, pcNumber?: string | null): number {
  if (!isControllerPriced(machine)) return costFromRates(roundedMinutes, machine);

  const controllers = controllerCount(pcNumber);
  const rate = machine.controllerRates?.[String(controllers)];
  if (rate && rate.hourly > 0) {
    return costFromRates(roundedMinutes, { hourlyRate: rate.hourly, halfHourlyRate: rate.halfHourly || null });
  }
  return costFromRates(roundedMinutes, machine) * controllers;
}
