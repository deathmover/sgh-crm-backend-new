import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { costFromRates, sessionCost, type ControllerRates, type PricedMachine } from './pricing';
import { Prisma } from '@prisma/client';
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
      hourlyRate: machine.hourlyRate,
      halfHourlyRate: machine.halfHourlyRate,
      packageRates: machine.packageRates,
      controllerRates: machine.controllerRates,
      availableUnits: machine.units - machine.entries.length,
      isAvailable: machine.entries.length < machine.units,
    }));
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
  }) {
    return this.prisma.machine.create({
      data: {
        name: createData.name,
        type: createData.type,
        units: createData.units,
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

    return this.prisma.machine.update({
      where: { id },
      data: dataToUpdate,
    });
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
