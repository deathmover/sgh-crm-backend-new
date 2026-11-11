import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { costFromRates, sessionCost, type ControllerRates, type PricedMachine } from './pricing';
import { Prisma } from '@prisma/client';
import { formatPcNumbers, parsePcNumbers } from './pc-numbers';
import { PrismaService } from '../../config/database.config';

@Injectable()
export class MachinesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const machines = await this.prisma.machine.findMany({
      where: { isActive: true }, // archived (deleted) machines keep their history but are hidden
      orderBy: { type: 'asc' },
      select: {
        id: true,
        name: true,
        type: true,
        units: true,
        pcNumbers: true,
        hourlyRate: true,
        halfHourlyRate: true,
        packageRates: true,
        controllerRates: true,
        createdAt: true,
        _count: {
          select: { entries: true },
        },
      },
    });

    return machines;
  }

  async findOne(id: string) {
    const machine = await this.prisma.machine.findUnique({
      where: { id },
      include: {
        _count: {
          select: { entries: true },
        },
      },
    });

    if (!machine) {
      throw new NotFoundException('Machine not found');
    }

    return machine;
  }

  async getMachineStats(id: string) {
    const machine = await this.findOne(id);

    const stats = await this.prisma.entry.aggregate({
      where: { machineId: id },
      _sum: {
        finalAmount: true,
        duration: true,
      },
      _count: true,
    });

    return {
      machine: {
        id: machine.id,
        name: machine.name,
        type: machine.type,
        units: machine.units,
      },
      totalSessions: stats._count,
      totalRevenue: stats._sum.finalAmount || 0,
      totalDuration: stats._sum.duration || 0,
    };
  }

  async getAvailableMachines() {
    // Get all machines with active (no endTime) entries count
    const machines = await this.prisma.machine.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        type: true,
        units: true,
        pcNumbers: true,
        hourlyRate: true,
        halfHourlyRate: true,
        packageRates: true,
        controllerRates: true,
        entries: {
          where: {
            endTime: null,
            isDeleted: false, // soft-deleted running sessions used to hold the unit forever
          },
          select: {
            id: true,
          },
        },
      },
    });

    return machines.map((machine) => ({
      id: machine.id,
      name: machine.name,
      type: machine.type,
      units: machine.units,
      pcNumbers: machine.pcNumbers,
      hourlyRate: machine.hourlyRate,
      halfHourlyRate: machine.halfHourlyRate,
      packageRates: machine.packageRates,
      controllerRates: machine.controllerRates,
      availableUnits: machine.units - machine.entries.length,
      isAvailable: machine.entries.length < machine.units,
    }));
  }

  /**
   * PC numbers to offer when starting sessions on this machine, and which are
   * in use right now. The numbers come from the last 90 days of sessions
   * (cafés number PCs their own way, e.g. Ultra = 12–17); a machine with no
   * history yet gets 1..units.
   */
  async getPcs(id: string) {
    const machine = await this.findOne(id);
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const [used, running] = await Promise.all([
      this.prisma.entry.groupBy({
        by: ['pcNumber'],
        where: { machineId: id, isDeleted: false, pcNumber: { not: null }, startTime: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.entry.findMany({
        where: { machineId: id, endTime: null, isDeleted: false, pcNumber: { not: null } },
        select: { id: true, pcNumber: true, startTime: true, predefinedDuration: true, customer: { select: { name: true } } },
      }),
    ]);
    const clean = (pc: string | null) => (pc ?? '').trim();
    // Typos ("30" on a 15-PC machine, an Ultra PC number under Mid Pro) show up
    // a handful of times; real PCs far more. Drop numbers used under 15% as often
    // as the busiest one. Any other number can still be typed in.
    const top = Math.max(0, ...used.map((u) => u._count._all));
    const seen = used
      .filter((u) => u._count._all >= top * 0.15)
      .map((u) => clean(u.pcNumber))
      .filter(Boolean);
    // The owner's list in Settings wins; otherwise what the café has been typing
    const configured = machine.pcNumbers ? parsePcNumbers(machine.pcNumbers).numbers : [];
    const source = configured.length ? 'settings' : seen.length ? 'history' : 'default';
    const base = configured.length ? configured : seen.length ? seen : Array.from({ length: Math.max(1, machine.units) }, (_, i) => String(i + 1));
    const numbers = new Set(base);
    for (const e of running) if (clean(e.pcNumber)) numbers.add(clean(e.pcNumber));
    const byNumber = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

    return {
      machineId: id,
      source,
      numbers: [...numbers].sort(byNumber),
      busy: running
        .filter((e) => clean(e.pcNumber))
        .map((e) => ({
          pcNumber: clean(e.pcNumber),
          entryId: e.id,
          customerName: e.customer?.name ?? null,
          startTime: e.startTime,
          predefinedDuration: e.predefinedDuration,
        }))
        .sort((a, b) => byNumber(a.pcNumber, b.pcNumber)),
    };
  }

  /** Cost for one unit at the machine's base rates (no controller pricing) */
  async calculateCost(machineId: string, durationMinutes: number): Promise<number> {
    const machine = await this.findOne(machineId);
    return costFromRates(durationMinutes, machine as unknown as PricedMachine);
  }

  /**
   * Play cost for a session, including per-controller pricing on PlayStation
   * (pcNumber holds the controller count there). Replaces the
   * "cost × controllers" logic that was copy-pasted in five places.
   */
  async calculateSessionCost(machineId: string, roundedMinutes: number, pcNumber?: string | null): Promise<number> {
    const machine = await this.findOne(machineId);
    return sessionCost(machine as unknown as PricedMachine, roundedMinutes, pcNumber);
  }

  /**
   * Round duration based on business rules
   * < 15 min → round down to nearest 30 min
   * >= 15 min → round up to nearest 30 min
   * @param durationMinutes - Actual duration in minutes
   * @returns Rounded duration in minutes
   */
  roundDuration(durationMinutes: number): number {
    const remainder = durationMinutes % 30;

    if (remainder < 15) {
      return durationMinutes - remainder;
    } else {
      return durationMinutes + (30 - remainder);
    }
  }

  async create(createData: {
    name: string;
    type: string;
    units: number;
    hourlyRate: number;
    halfHourlyRate?: number;
    controllerRates?: ControllerRates;
    pcNumbers?: string | null;
  }) {
    const pcs = this.checkPcNumbers(createData.pcNumbers);
    return this.prisma.machine.create({
      data: {
        name: createData.name,
        type: createData.type,
        units: pcs?.length || createData.units,
        ...(pcs && { pcNumbers: formatPcNumbers(pcs) }),
        hourlyRate: createData.hourlyRate,
        halfHourlyRate: createData.halfHourlyRate || null,
        ...(createData.controllerRates && { controllerRates: cleanControllerRates(createData.controllerRates) }),
        isActive: true,
      },
    });
  }

  async updateRates(
    id: string,
    updateData: {
      hourlyRate?: number;
      halfHourlyRate?: number | null;
      packageRates?: Record<string, number>;
      controllerRates?: ControllerRates | null;
      /** "1-11"; units becomes its count. null or "" clears it. */
      pcNumbers?: string | null;
    },
  ) {
    const machine = await this.findOne(id);

    const dataToUpdate: any = {
      hourlyRate: updateData.hourlyRate ?? machine.hourlyRate,
      // null clears the half-hour rate (?? used to make that impossible)
      halfHourlyRate: updateData.halfHourlyRate === undefined ? machine.halfHourlyRate : updateData.halfHourlyRate || null,
    };

    if (updateData.controllerRates !== undefined) {
      const cleaned = updateData.controllerRates ? cleanControllerRates(updateData.controllerRates) : {};
      dataToUpdate.controllerRates = Object.keys(cleaned).length ? cleaned : Prisma.DbNull;
    }

    if (updateData.packageRates !== undefined) {
      dataToUpdate.packageRates = updateData.packageRates;
    }

    if (updateData.pcNumbers !== undefined) {
      const pcs = this.checkPcNumbers(updateData.pcNumbers);
      dataToUpdate.pcNumbers = pcs ? formatPcNumbers(pcs) : null;
      if (pcs) dataToUpdate.units = pcs.length;
    }

    return this.prisma.machine.update({
      where: { id },
      data: dataToUpdate,
    });
  }

  /** Parsed PC numbers, or null when blank. Bad input is a 400 naming the problem. */
  private checkPcNumbers(text?: string | null): string[] | null {
    if (!text?.trim()) return null;
    const { numbers, error } = parsePcNumbers(text);
    if (error) throw new BadRequestException(`PC numbers: ${error}`);
    return numbers.length ? numbers : null;
  }

  /**
   * Machines with no history are deleted. Ones with past sessions or bookings
   * are archived instead (hidden everywhere) so past revenue stays intact.
   */
  async remove(id: string) {
    const machine = await this.findOne(id);

    const [activeSessions, entries, bookings] = await Promise.all([
      this.prisma.entry.count({ where: { machineId: id, endTime: null, isDeleted: false } }),
      this.prisma.entry.count({ where: { machineId: id } }),
      this.prisma.booking.count({ where: { machineId: id } }),
    ]);

    if (activeSessions > 0) {
      throw new BadRequestException(
        `${machine.name} has ${activeSessions} session${activeSessions === 1 ? '' : 's'} running. End ${activeSessions === 1 ? 'it' : 'them'} first.`,
      );
    }

    if (entries === 0 && bookings === 0) {
      await this.prisma.machine.delete({ where: { id } });
      return { id, result: 'deleted' as const };
    }

    await this.prisma.machine.update({ where: { id }, data: { isActive: false } });
    return { id, result: 'archived' as const };
  }
}

/** Keep only rows with a valid controller count and a positive hourly price */
function cleanControllerRates(rates: ControllerRates): ControllerRates {
  const cleaned: ControllerRates = {};
  for (const [count, rate] of Object.entries(rates)) {
    const n = parseInt(count, 10);
    const hourly = Math.round(Number(rate?.hourly));
    if (n > 0 && hourly > 0) {
      const halfHourly = Math.round(Number(rate?.halfHourly));
      cleaned[String(n)] = { hourly, ...(halfHourly > 0 && { halfHourly }) };
    }
  }
  return cleaned;
}
