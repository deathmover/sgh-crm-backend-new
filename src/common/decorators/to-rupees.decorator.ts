import { Transform } from 'class-transformer';

/**
 * Money columns are Int (whole rupees) in the schema. The UI sends parseFloat
 * values, so 150.5 used to pass validation and then fail in Prisma with a 500.
 * Round at the boundary instead.
 */
export const ToRupees = () =>
  Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return value;
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : value;
  });
