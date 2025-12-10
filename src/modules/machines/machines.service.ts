import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/database.config';

@Injectable()
export class MachinesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const machines = await this.prisma.machine.findMany({
      orderBy: { type: 'asc' },
      select: {
        id: true,
        name: true,
        type: true,
        units: true,
        hourlyRate: true,
        halfHourlyRate: true,
        packageRates: true,
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
      select: {
        id: true,
        name: true,
        type: true,
        units: true,
        hourlyRate: true,
        halfHourlyRate: true,
        packageRates: true,
        entries: {
          where: {
            endTime: null,
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
      availableUnits: machine.units - machine.entries.length,
      isAvailable: machine.entries.length < machine.units,
    }));
  }

  /**
   * Calculate cost based on duration and machine pricing
   * @param machineId - Machine ID
   * @param durationMinutes - Duration in minutes
   * @returns Calculated cost
   */
  async calculateCost(
    machineId: string,
    durationMinutes: number,
  ): Promise<number> {
    const machine = await this.findOne(machineId);
    const durationHours = durationMinutes / 60;

    // Check for package rates first - use only ONE package, then calculate rest at hourly rates
    if (machine.packageRates) {
      const packageRates = machine.packageRates as Record<string, number>;
      const packageHours = Object.keys(packageRates)
        .map(Number)
        .sort((a, b) => b - a);

      for (const hours of packageHours) {
        if (durationHours >= hours) {
          // Use only ONE package (not multiple)
          const packageCost = packageRates[hours.toString()];
          const remainingHours = durationHours - hours;

          // Calculate remaining time cost using the same logic as the regular calculation
          const remainingMinutes = remainingHours * 60;
          let remainingCost = 0;

          if (remainingMinutes > 0) {
            // If ≤ 30 minutes and half-hourly rate exists, use it
            if (remainingMinutes <= 30 && machine.halfHourlyRate) {
              remainingCost = machine.halfHourlyRate;
            }
            // For time > 30 minutes with half-hourly rate, calculate in blocks
            else if (remainingMinutes > 30 && machine.halfHourlyRate) {
              const fullHours = Math.floor(remainingMinutes / 60);
              const remainingMins = remainingMinutes % 60;

              remainingCost = fullHours * machine.hourlyRate;

              if (remainingMins === 30) {
                // Exactly 30 minutes remaining, use half-hourly rate
                remainingCost += machine.halfHourlyRate;
              } else if (remainingMins > 0) {
                // Less than 30 minutes remaining, charge full hour
                remainingCost += machine.hourlyRate;
              }
            }
            // Default to hourly rate (for machines without half-hourly rate)
            else {
              remainingCost = Math.ceil(remainingHours) * machine.hourlyRate;
            }
          }

          return packageCost + remainingCost;
        }
      }
    }

    // Calculate based on hourly/half-hourly rates
    if (durationMinutes <= 30 && machine.halfHourlyRate) {
      return machine.halfHourlyRate;
    }

    // For time > 30 minutes, calculate in blocks
    // Example: 90 mins = 60 mins (1 hour) + 30 mins (half hour)
    if (durationMinutes > 30 && machine.halfHourlyRate) {
      const fullHours = Math.floor(durationMinutes / 60);
      const remainingMinutes = durationMinutes % 60;

      let cost = fullHours * machine.hourlyRate;

      if (remainingMinutes === 30) {
        // Exactly 30 minutes remaining, use half-hourly rate
        cost += machine.halfHourlyRate;
      } else if (remainingMinutes > 0) {
        // Less than 30 minutes remaining, charge full hour
        cost += machine.hourlyRate;
      }

      return cost;
    }

    // Default to hourly rate calculation (for machines without half-hourly rate)
    return Math.ceil(durationHours) * machine.hourlyRate;
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
  }) {
    return this.prisma.machine.create({
      data: {
        name: createData.name,
        type: createData.type,
        units: createData.units,
        hourlyRate: createData.hourlyRate,
        halfHourlyRate: createData.halfHourlyRate || null,
        isActive: true,
      },
    });
  }

  async updateRates(
    id: string,
    updateData: {
      hourlyRate?: number;
      halfHourlyRate?: number;
      packageRates?: Record<string, number>;
    },
  ) {
    const machine = await this.findOne(id);

    const dataToUpdate: any = {
      hourlyRate: updateData.hourlyRate ?? machine.hourlyRate,
      halfHourlyRate: updateData.halfHourlyRate ?? machine.halfHourlyRate,
    };

    if (updateData.packageRates !== undefined) {
      dataToUpdate.packageRates = updateData.packageRates;
    }

    return this.prisma.machine.update({
      where: { id },
      data: dataToUpdate,
    });
  }
}
