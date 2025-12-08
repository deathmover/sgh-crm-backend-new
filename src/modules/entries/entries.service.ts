import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Parser } from 'json2csv';
import { PrismaService } from '../../config/database.config';
import { MachinesService } from '../machines/machines.service';
import { MembershipsService } from '../memberships/memberships.service';
import { CreateEntryDto } from './dto/create-entry.dto';
import { EndEntryDto } from './dto/end-entry.dto';
import { EntryQueryDto } from './dto/entry-query.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Injectable()
export class EntriesService {
  constructor(
    private prisma: PrismaService,
    private machinesService: MachinesService,
    @Inject(forwardRef(() => MembershipsService))
    private membershipsService: MembershipsService,
  ) {}

  async create(createEntryDto: CreateEntryDto) {
    const { customerId, machineId, startTime, predefinedDuration, cashAmount, onlineAmount, creditAmount, pcNumber, notes, useMembershipId } =
      createEntryDto;

    // Verify customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Verify machine exists and check availability
    const machine = await this.prisma.machine.findUnique({
      where: { id: machineId },
      include: {
        entries: {
          where: { endTime: null, isDeleted: false },
        },
      },
    });

    if (!machine) {
      throw new NotFoundException('Machine not found');
    }

    if (machine.entries.length >= machine.units) {
      throw new BadRequestException(
        `Machine ${machine.name} is fully occupied`,
      );
    }

    // Check if membership should be used
    let membershipId: string | undefined = undefined;
    let membershipHours: number | undefined = undefined;
    let membership: any = null;

    if (useMembershipId) {
      // Check if membership system is enabled
      const isEnabled = await this.membershipsService.isMembershipEnabled();
      if (!isEnabled) {
        throw new BadRequestException('Membership system is currently disabled');
      }

      // Get membership details
      membership = await this.prisma.customerMembership.findUnique({
        where: { id: useMembershipId },
        include: { plan: true },
      });

      if (!membership) {
        throw new NotFoundException('Membership not found');
      }

      if (membership.customerId !== customerId) {
        throw new BadRequestException('Membership does not belong to this customer');
      }

      if (membership.status !== 'active') {
        throw new BadRequestException(`Membership is ${membership.status}, not active`);
      }

      if (membership.hoursRemaining <= 0) {
        throw new BadRequestException('Membership has no hours remaining');
      }

      if (new Date() > new Date(membership.expiryDate)) {
        throw new BadRequestException('Membership has expired');
      }

      // Check if machine type matches membership plan
      if (membership.plan.machineType !== machine.type) {
        throw new BadRequestException(
          `Membership is for ${membership.plan.machineType} machines, but selected machine is ${machine.type}`
        );
      }

      // If predefined duration provided, calculate hours needed
      if (predefinedDuration) {
        const hoursNeeded = predefinedDuration / 60; // Convert minutes to hours
        if (hoursNeeded > membership.hoursRemaining) {
          throw new BadRequestException(
            `Not enough hours in membership. Need: ${hoursNeeded.toFixed(2)} hrs, Available: ${membership.hoursRemaining.toFixed(2)} hrs`
          );
        }
      }

      membershipId = useMembershipId;
    }

    // Calculate payment status if advance payment provided
    const cash = cashAmount || 0;
    const online = onlineAmount || 0;
    const credit = creditAmount || 0;
    const totalAdvancePayment = cash + online + credit;

    let paymentStatus: string | undefined = undefined;
    if (totalAdvancePayment > 0) {
      paymentStatus = 'partial'; // Advance payment means partial until session ends
    }

    // If using membership, set payment as paid (no money charged)
    if (membershipId) {
      paymentStatus = 'paid'; // Membership sessions are considered paid
    }

    // Calculate estimated cost if predefined duration is provided
    let estimatedCost = 0;
    let roundedDuration: number | undefined = undefined;
    let estimatedFinalAmount = 0;

    if (predefinedDuration) {
      roundedDuration = this.machinesService.roundDuration(predefinedDuration);
      estimatedCost = await this.machinesService.calculateCost(
        machineId,
        roundedDuration,
      );

      // For PS5 machines, multiply by number of controllers
      if (machine.type === 'ps5' && pcNumber) {
        const controllers = parseInt(pcNumber) || 1;
        estimatedCost = estimatedCost * (controllers > 0 ? controllers : 1);
      }

      estimatedFinalAmount = estimatedCost;

      // If using membership, deduct EXACT hours (not rounded)
      if (membershipId && membership) {
        const hoursToDeduct = predefinedDuration / 60; // Use exact minutes, not rounded
        membershipHours = hoursToDeduct;
        await this.membershipsService.deductHours(membershipId, hoursToDeduct);
      }
    }

    // Create entry with initial values
    return this.prisma.entry.create({
      data: {
        customerId,
        machineId,
        startTime: new Date(startTime),
        predefinedDuration,
        roundedDuration,
        cost: estimatedCost || undefined,
        finalAmount: membershipId ? 0 : estimatedFinalAmount, // ₹0 if using membership
        paymentType: 'cash', // Default, will be updated on end
        cashAmount: cash,
        onlineAmount: online,
        creditAmount: credit,
        pcNumber,
        membershipId,
        membershipHours,
        ...(paymentStatus && { paymentStatus }),
        notes,
      },
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        machine: {
          select: {
            id: true,
            name: true,
            type: true,
            hourlyRate: true,
            halfHourlyRate: true,
            packageRates: true,
          },
        },
        membership: {
          include: {
            plan: true,
          },
        },
      },
    });
  }

  async endEntry(id: string, endEntryDto: EndEntryDto, autoEnded = false) {
    const entry = await this.prisma.entry.findUnique({
      where: { id },
      include: { machine: true },
    });

    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    if (entry.endTime) {
      throw new BadRequestException('Entry already ended');
    }

    const endTime = new Date(endEntryDto.endTime);
    const startTime = new Date(entry.startTime);

    if (endTime <= startTime) {
      throw new BadRequestException('End time must be after start time');
    }

    // Calculate duration in minutes
    const durationMinutes = Math.floor(
      (endTime.getTime() - startTime.getTime()) / (1000 * 60),
    );

    // Round duration based on business rules
    const roundedDuration = this.machinesService.roundDuration(durationMinutes);

    // Calculate cost based on rounded duration
    let calculatedCost = await this.machinesService.calculateCost(
      entry.machineId,
      roundedDuration,
    );

    // For PS5 machines, multiply by number of controllers
    if (entry.machine.type === 'ps5' && entry.pcNumber) {
      const controllers = parseInt(entry.pcNumber) || 1;
      calculatedCost = calculatedCost * (controllers > 0 ? controllers : 1);
    }

    // Determine play amount:
    // 1. If user explicitly provides finalAmount in endEntryDto, use it
    // 2. Else if entry already has finalAmount from creation (predefined duration), keep it
    // 3. Else calculate based on actual duration
    let playAmount: number;
    if (endEntryDto.finalAmount && endEntryDto.finalAmount > 0) {
      // User explicitly provided amount
      playAmount = endEntryDto.finalAmount;
    } else if (entry.finalAmount > 0) {
      // Entry was created with predefined duration, keep original amount
      playAmount = entry.finalAmount;
    } else {
      // Calculate based on actual duration
      playAmount = calculatedCost;
    }

    const beveragesAmount = entry.beveragesAmount || 0;
    const finalAmount = playAmount + beveragesAmount;

    // Handle split payments - add to existing advance payments
    let cashAmount = entry.cashAmount || 0;
    let onlineAmount = entry.onlineAmount || 0;
    let creditAmount = entry.creditAmount || 0;

    // ADD new payments to existing advance payment
    cashAmount += endEntryDto.cashAmount || 0;
    onlineAmount += endEntryDto.onlineAmount || 0;

    // Only add to credit if user explicitly provides creditAmount
    const newCreditAmount = endEntryDto.creditAmount || 0;
    creditAmount += newCreditAmount;

    // Calculate total actually paid (cash + online + explicit credit)
    const totalPaid = cashAmount + onlineAmount + creditAmount;

    // Calculate payment status
    let paymentStatus = 'unpaid';
    if (totalPaid >= finalAmount) {
      paymentStatus = 'paid';
    } else if (totalPaid > 0) {
      paymentStatus = 'partial';
    }

    // Combine notes
    const combinedNotes = [entry.notes, endEntryDto.notes]
      .filter(Boolean)
      .join(' | ');

    return this.prisma.entry.update({
      where: { id },
      data: {
        endTime,
        duration: durationMinutes,
        roundedDuration,
        cost: calculatedCost,
        finalAmount,
        paymentType: endEntryDto.paymentType,
        paymentStatus,
        cashAmount,
        onlineAmount,
        creditAmount,
        autoEnded,
        notes: combinedNotes || null,
      },
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        machine: {
          select: {
            id: true,
            name: true,
            type: true,
            hourlyRate: true,
            halfHourlyRate: true,
            packageRates: true,
          },
        },
      },
    });
  }

  async findAll(query: EntryQueryDto) {
    const {
      date,
      startDate,
      endDate,
      customerId,
      machineId,
      paymentType,
      page = 1,
      limit = 50,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Date filtering
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      where.createdAt = {
        gte: startOfDay,
        lte: endOfDay,
      };
    } else if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    if (customerId) where.customerId = customerId;
    if (machineId) where.machineId = machineId;
    if (paymentType) where.paymentType = paymentType;

    // Exclude deleted entries
    where.isDeleted = false;

    const [entries, total] = await Promise.all([
      this.prisma.entry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { id: true, name: true, phone: true },
          },
          machine: {
            select: {
              id: true,
              name: true,
              type: true,
              hourlyRate: true,
              halfHourlyRate: true,
              packageRates: true,
            },
          },
          membership: {
            select: {
              id: true,
              plan: {
                select: {
                  name: true,
                  machineType: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.entry.count({ where }),
    ]);

    return {
      data: entries,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const entry = await this.prisma.entry.findUnique({
      where: { id },
      include: {
        customer: true,
        machine: true,
        membership: {
          select: {
            id: true,
            plan: {
              select: {
                name: true,
                machineType: true,
              },
            },
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    return entry;
  }

  getActiveEntries() {
    return this.prisma.entry.findMany({
      where: { endTime: null, isDeleted: false },
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        machine: {
          select: {
            id: true,
            name: true,
            type: true,
            hourlyRate: true,
            halfHourlyRate: true,
            packageRates: true,
          },
        },
        membership: {
          select: {
            id: true,
            plan: {
              select: {
                name: true,
                machineType: true,
              },
            },
          },
        },
      },
      orderBy: { startTime: 'desc' },
    });
  }

  async getDailySheet(date: string) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const dateFilter = {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
      isDeleted: false,
    };

    const entries = await this.prisma.entry.findMany({
      where: dateFilter,
      include: {
        customer: {
          select: { id: true, name: true, phone: true, pendingCredit: true },
        },
        machine: {
          select: {
            id: true,
            name: true,
            type: true,
            hourlyRate: true,
            halfHourlyRate: true,
            packageRates: true,
          },
        },
      },
      orderBy: {
        startTime: 'asc', // Sort by start time ascending (earliest first)
      },
    });

    // Get all entries (including active)
    const totalEntries = entries.length;

    // Get active entries count
    const activeEntries = entries.filter((entry) => !entry.endTime).length;

    // Get payment breakdown - using split payment fields
    const [cashData, onlineData, creditData] = await Promise.all([
      this.prisma.entry.aggregate({
        where: {
          ...dateFilter,
          endTime: { not: null },
        },
        _sum: { cashAmount: true },
      }),
      this.prisma.entry.aggregate({
        where: {
          ...dateFilter,
          endTime: { not: null },
        },
        _sum: { onlineAmount: true },
      }),
      this.prisma.entry.aggregate({
        where: {
          ...dateFilter,
          endTime: { not: null },
        },
        _sum: { creditAmount: true },
      }),
    ]);

    const cashRevenue = cashData._sum.cashAmount || 0;
    const onlineRevenue = onlineData._sum.onlineAmount || 0;
    const creditRevenue = creditData._sum.creditAmount || 0;
    const totalRevenue = cashRevenue + onlineRevenue;

    return {
      entries,
      summary: {
        totalRevenue,
        cashRevenue,
        onlineRevenue,
        creditRevenue,
        totalEntries,
        activeEntries,
      },
    };
  }

  async update(id: string, updateData: any) {
    const entry = await this.findOne(id);

    // Prepare the data to update
    const dataToUpdate = { ...updateData };

    // If predefinedDuration is being updated, recalculate cost
    if (updateData.predefinedDuration !== undefined) {
      const machineId = updateData.machineId || entry.machineId;
      const predefinedDuration = updateData.predefinedDuration;
      const pcNumber = updateData.pcNumber || entry.pcNumber;

      if (predefinedDuration && predefinedDuration > 0) {
        const roundedDuration = this.machinesService.roundDuration(predefinedDuration);
        let calculatedCost = await this.machinesService.calculateCost(
          machineId,
          roundedDuration,
        );

        // For PS5 machines, multiply by number of controllers
        const machine = await this.prisma.machine.findUnique({
          where: { id: machineId },
        });

        if (machine && machine.type === 'ps5' && pcNumber) {
          const controllers = parseInt(pcNumber) || 1;
          calculatedCost = calculatedCost * (controllers > 0 ? controllers : 1);
        }

        dataToUpdate.cost = calculatedCost;
        dataToUpdate.roundedDuration = roundedDuration;

        // If finalAmount is not explicitly provided, calculate it
        if (updateData.finalAmount === undefined) {
          const beveragesAmount = updateData.beveragesAmount !== undefined
            ? updateData.beveragesAmount
            : entry.beveragesAmount || 0;
          dataToUpdate.finalAmount = calculatedCost + beveragesAmount;
        }
      }
    }

    // Allow updating ended entries (for PC number, beverages, notes, payment)
    return this.prisma.entry.update({
      where: { id },
      data: dataToUpdate,
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        machine: {
          select: {
            id: true,
            name: true,
            type: true,
            hourlyRate: true,
            halfHourlyRate: true,
            packageRates: true,
          },
        },
      },
    });
  }

  async softDelete(id: string) {
    const entry = await this.findOne(id);

    // Note: pendingCredit is calculated dynamically from entries, no need to update customer table

    return this.prisma.entry.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        machine: {
          select: {
            id: true,
            name: true,
            type: true,
            hourlyRate: true,
            halfHourlyRate: true,
            packageRates: true,
          },
        },
      },
    });
  }

  async getDeleted(query: any) {
    const { page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      this.prisma.entry.findMany({
        where: { isDeleted: true },
        skip,
        take: limit,
        orderBy: { deletedAt: 'desc' },
        include: {
          customer: {
            select: { id: true, name: true, phone: true },
          },
          machine: {
            select: {
              id: true,
              name: true,
              type: true,
              hourlyRate: true,
              halfHourlyRate: true,
              packageRates: true,
            },
          },
        },
      }),
      this.prisma.entry.count({ where: { isDeleted: true } }),
    ]);

    return {
      data: entries,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async restore(id: string) {
    const entry = await this.prisma.entry.findUnique({ where: { id } });

    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    if (!entry.isDeleted) {
      throw new BadRequestException('Entry is not deleted');
    }

    // Note: pendingCredit is calculated dynamically from entries, no need to update customer table

    return this.prisma.entry.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
      },
    });
  }

  async delete(id: string) {
    const entry = await this.findOne(id);

    // Note: pendingCredit is calculated dynamically from entries, no need to update customer table

    return this.prisma.entry.delete({
      where: { id },
    });
  }

  async updatePayment(id: string, updatePaymentDto: UpdatePaymentDto) {
    const entry = await this.findOne(id);

    // Calculate total paid (cash + online + explicit credit)
    const totalPaid =
      updatePaymentDto.cashAmount +
      updatePaymentDto.onlineAmount +
      updatePaymentDto.creditAmount;

    // Calculate payment status
    let paymentStatus: string;
    if (totalPaid >= entry.finalAmount) {
      paymentStatus = 'paid';
    } else if (totalPaid > 0) {
      paymentStatus = 'partial';
    } else {
      paymentStatus = 'unpaid';
    }

    return this.prisma.entry.update({
      where: { id },
      data: {
        cashAmount: updatePaymentDto.cashAmount,
        onlineAmount: updatePaymentDto.onlineAmount,
        creditAmount: updatePaymentDto.creditAmount, // Use explicit credit amount from user
        paymentStatus,
        notes: updatePaymentDto.notes || entry.notes,
      },
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        machine: {
          select: {
            id: true,
            name: true,
            type: true,
            hourlyRate: true,
            halfHourlyRate: true,
            packageRates: true,
          },
        },
      },
    });
  }

  async exportToCsv(query: EntryQueryDto): Promise<string> {
    const {
      date,
      startDate,
      endDate,
      customerId,
      machineId,
      paymentType,
    } = query;

    const where: any = { isDeleted: false };

    // Date filtering
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      where.createdAt = {
        gte: startOfDay,
        lte: endOfDay,
      };
    } else if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    if (customerId) where.customerId = customerId;
    if (machineId) where.machineId = machineId;
    if (paymentType) where.paymentType = paymentType;

    // Get all entries (no pagination for export)
    const entries = await this.prisma.entry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: { name: true, phone: true },
        },
        machine: {
          select: { name: true, type: true },
        },
        membership: {
          select: {
            plan: {
              select: { name: true },
            },
          },
        },
      },
    });

    // Format entries for CSV
    const formattedEntries = entries.map((entry) => ({
      'Customer Name': entry.customer?.name || '',
      'Customer Phone': entry.customer?.phone || '',
      'Machine': entry.machine?.name || '',
      'Machine Type': entry.machine?.type || '',
      'Start Time': entry.startTime.toISOString(),
      'End Time': entry.endTime ? entry.endTime.toISOString() : 'Active',
      'Duration (min)': entry.duration || '',
      'PC/Unit Number': entry.pcNumber || '',
      'Cost': entry.cost || 0,
      'Beverages': entry.beveragesAmount || 0,
      'Final Amount': entry.finalAmount,
      'Cash Amount': entry.cashAmount,
      'Online Amount': entry.onlineAmount,
      'Credit Amount': entry.creditAmount,
      'Payment Status': entry.paymentStatus || '',
      'Membership': entry.membership?.plan?.name || '',
      'Membership Hours': entry.membershipHours || '',
      'Auto Ended': entry.autoEnded ? 'Yes' : 'No',
      'Notes': entry.notes || '',
    }));

    // Convert to CSV
    const parser = new Parser({
      fields: [
        'Customer Name',
        'Customer Phone',
        'Machine',
        'Machine Type',
        'Start Time',
        'End Time',
        'Duration (min)',
        'PC/Unit Number',
        'Cost',
        'Beverages',
        'Final Amount',
        'Cash Amount',
        'Online Amount',
        'Credit Amount',
        'Payment Status',
        'Membership',
        'Membership Hours',
        'Auto Ended',
        'Notes',
      ],
    });

    return parser.parse(formattedEntries);
  }

  async autoEndExpiredSessions() {
    const now = new Date();

    const expiredEntries = await this.prisma.entry.findMany({
      where: {
        endTime: null,
        predefinedDuration: { not: null },
        isDeleted: false,
      },
      include: { machine: true, customer: true },
    });

    const entriesToEnd = expiredEntries.filter((entry) => {
      if (!entry.predefinedDuration) return false;
      const expectedEnd = new Date(entry.startTime);
      expectedEnd.setMinutes(
        expectedEnd.getMinutes() + entry.predefinedDuration,
      );
      const isExpired = now >= expectedEnd;

      return isExpired;
    });

    const results: any[] = [];
    for (const entry of entriesToEnd) {
      if (!entry.predefinedDuration) continue;
      const expectedEnd = new Date(entry.startTime);
      expectedEnd.setMinutes(
        expectedEnd.getMinutes() + entry.predefinedDuration,
      );

      try {
        // Calculate the cost for the predefined duration
        const roundedDuration = this.machinesService.roundDuration(
          entry.predefinedDuration,
        );
        let calculatedCost = await this.machinesService.calculateCost(
          entry.machineId,
          roundedDuration,
        );

        // For PS5 machines, multiply by number of controllers
        if (entry.machine.type === 'ps5' && entry.pcNumber) {
          const controllers = parseInt(entry.pcNumber) || 1;
          calculatedCost = calculatedCost * (controllers > 0 ? controllers : 1);
        }

        // Pass only the play amount (calculatedCost)
        // endEntry will add beverages automatically from entry.beveragesAmount
        const ended = await this.endEntry(
          entry.id,
          {
            endTime: expectedEnd.toISOString(),
            paymentType: 'credit', // Legacy field
            finalAmount: calculatedCost, // Only pass play amount, not including beverages
            cashAmount: 0,
            onlineAmount: 0,
            creditAmount: 0, // Don't pass creditAmount, let endEntry calculate it
            notes: 'Auto-ended at predefined duration',
          },
          true, // autoEnded = true
        );

        results.push(ended);
      } catch (error) {
        // Silently handle individual entry failures
      }
    }

    return results;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleAutoEndCron() {
    try {
      await this.autoEndExpiredSessions();
    } catch (error) {
      // Silently handle cron errors
    }
  }
}
