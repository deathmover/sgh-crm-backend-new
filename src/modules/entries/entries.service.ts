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
import { ProductsService, type ItemLine } from '../products/products.service';
import { EntryItemInputDto } from '../products/dto/product.dto';
import { CreateEntryDto } from './dto/create-entry.dto';
import { EndEntryDto } from './dto/end-entry.dto';
import { EntryQueryDto } from './dto/entry-query.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { dayRange, dateRange } from '../../common/utils/date-range';
import { getOtherCollections } from '../../common/utils/collections';

const paymentStatusFor = (totalPaid: number, finalAmount: number) =>
  totalPaid >= finalAmount ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid';

@Injectable()
export class EntriesService {
  constructor(
    private prisma: PrismaService,
    private machinesService: MachinesService,
    private productsService: ProductsService,
    @Inject(forwardRef(() => MembershipsService))
    private membershipsService: MembershipsService,
  ) {}

  async create(createEntryDto: CreateEntryDto) {
    const { customerId, machineId, startTime, predefinedDuration, cashAmount, onlineAmount, creditAmount, pcNumber, discount, notes, useMembershipId, finalAmount: finalAmountOverride, items } =
      createEntryDto;

    // Menu items, when given, decide the snacks amount
    const itemLines = items?.length ? await this.productsService.buildLines(this.prisma, items) : [];
    const beveragesAmount = itemLines.length
      ? itemLines.reduce((sum, l) => sum + l.total, 0)
      : createEntryDto.beveragesAmount;

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

    // Occupation check disabled - allow entries even if machine is at capacity
    // if (machine.entries.length >= machine.units) {
    //   throw new BadRequestException(
    //     `Machine ${machine.name} is fully occupied`,
    //   );
    // }

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

    // Membership sessions are paid, unless snacks were ordered
    if (membershipId && !(itemLines.length ? itemLines.reduce((s, l) => s + l.total, 0) : beveragesAmount)) {
      paymentStatus = 'paid';
    }

    // Calculate estimated cost if predefined duration is provided
    let estimatedCost = 0;
    let roundedDuration: number | undefined = undefined;
    let estimatedFinalAmount = 0;

    if (predefinedDuration) {
      roundedDuration = this.machinesService.roundDuration(predefinedDuration);
      // Includes per-controller pricing for PlayStation
      estimatedCost = await this.machinesService.calculateSessionCost(machineId, roundedDuration, pcNumber);

      estimatedFinalAmount = estimatedCost;

      // Apply discount if provided
      const discountAmount = discount || 0;
      if (discountAmount > 0) {
        estimatedFinalAmount = Math.max(0, estimatedFinalAmount - discountAmount);
      }

      // Add beverages amount if provided
      const beverages = beveragesAmount || 0;
      if (beverages > 0) {
        estimatedFinalAmount = estimatedFinalAmount + beverages;
      }

      // Operator edited the amount in the dialog (already includes discount and beverages)
      if (finalAmountOverride !== undefined && finalAmountOverride >= 0) {
        estimatedFinalAmount = finalAmountOverride;
      }

      // If using membership, deduct EXACT hours (not rounded)
      if (membershipId && membership) {
        membershipHours = predefinedDuration / 60; // Use exact minutes, not rounded
      }
    }

    // Membership sessions without a fixed duration have nothing to deduct, so
    // they would play for free; require a duration up front instead.
    if (membershipId && !membershipHours) {
      throw new BadRequestException('Set an expected duration to use membership hours');
    }

    // Create entry with initial values
    const created = await this.prisma.entry.create({
      data: {
        customerId,
        machineId,
        startTime: new Date(startTime),
        predefinedDuration,
        ...(roundedDuration && { duration: roundedDuration }), // Set duration immediately for display in daily sheet
        roundedDuration,
        cost: estimatedCost || undefined,
        discount: discount || 0,
        beveragesAmount: beveragesAmount || 0,
        // Membership covers play time only; snacks are still charged
        finalAmount: membershipId ? beveragesAmount || 0 : estimatedFinalAmount,
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
            controllerRates: true,
          },
        },
        membership: {
          include: {
            plan: true,
          },
        },
      },
    });

    if (itemLines.length) {
      await this.prisma.$transaction(async (tx) => {
        await tx.entryItem.createMany({ data: itemLines.map((l) => ({ ...l, entryId: created.id })) });
        await this.productsService.applyStockDiff(tx, created.id, [], itemLines);
      });
    }

    // Deduct hours only once the entry exists, so a failed create can't eat them
    if (membershipId && membershipHours) {
      try {
        await this.membershipsService.deductHours(membershipId, membershipHours);
      } catch (error) {
        await this.prisma.entry.delete({ where: { id: created.id } });
        throw error;
      }
    }

    return created;
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
    const calculatedCost = await this.machinesService.calculateSessionCost(entry.machineId, roundedDuration, entry.pcNumber);

    // Determine final amount:
    // 1. If user explicitly provides finalAmount in endEntryDto, use it AS-IS (already includes beverages and discount)
    // 2. Else if entry already has finalAmount from creation (predefined duration), use it as-is (already includes discount and beverages)
    // 3. Else calculate based on actual duration: (cost - discount) + beverages
    const beveragesAmount = entry.beveragesAmount || 0;
    const discount = entry.discount || 0;
    let finalAmount: number;

    if (entry.membershipId) {
      // Play time is covered by membership hours; finalAmount was 0 at create, which
      // used to fall through to the "calculate from duration" branch and bill the
      // full play cost (leaving every membership session marked unpaid).
      finalAmount = endEntryDto.finalAmount && endEntryDto.finalAmount > 0
        ? endEntryDto.finalAmount
        : entry.finalAmount || 0;
    } else if (endEntryDto.finalAmount && endEntryDto.finalAmount > 0) {
      // User explicitly provided amount - treat as complete total (already includes beverages and discount)
      finalAmount = endEntryDto.finalAmount;
    } else if (entry.finalAmount > 0) {
      // Entry was created with predefined duration, finalAmount already includes discount and beverages
      finalAmount = entry.finalAmount;
    } else {
      // Calculate based on actual duration: (cost - discount) + beverages
      finalAmount = Math.max(0, calculatedCost - discount) + beveragesAmount;
    }

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
    const totalPaid = cashAmount + onlineAmount + creditAmount + (entry.creditPaid || 0);

    const paymentStatus = paymentStatusFor(totalPaid, finalAmount);

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
            controllerRates: true,
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

    // Date filtering by session start (local calendar days; endDate inclusive).
    // createdAt put backdated entries on the day they were typed in.
    if (date) {
      where.startTime = dayRange(date);
    } else if (startDate && endDate) {
      where.startTime = dateRange(startDate, endDate);
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
              controllerRates: true,
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
        items: {
          select: { id: true, productId: true, name: true, unitPrice: true, quantity: true, total: true },
          orderBy: { createdAt: 'asc' },
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
        items: {
          select: { id: true, productId: true, name: true, unitPrice: true, quantity: true, total: true },
          orderBy: { createdAt: 'asc' },
        },

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
            controllerRates: true,
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

  async getDailySheet(date?: string) {
    // Without a date this used to build an Invalid Date and fail; default to today
    const dayWindow = dayRange(date || undefined);
    // Sessions belong to the day they started, not the day they were entered
    const dateFilter = {
      startTime: dayWindow,
      isDeleted: false,
    };

    const entries = await this.prisma.entry.findMany({
      where: dateFilter,
      include: {
        items: {
          select: { id: true, productId: true, name: true, unitPrice: true, quantity: true, total: true },
          orderBy: { createdAt: 'asc' },
        },

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
            controllerRates: true,
          },
        },
      },
      orderBy: {
        startTime: 'desc', // Sort by start time ascending (earliest first)
      },
    });

    // Get unique customer IDs from entries
    const customerIds = [...new Set(entries.map(e => e.customerId).filter(Boolean))];

    // Calculate entry-based credit for all customers in a single query
    const customerCreditMap = new Map<string, number>();
    if (customerIds.length > 0) {
      const creditStats = await this.prisma.entry.groupBy({
        by: ['customerId'],
        where: {
          customerId: { in: customerIds },
          creditAmount: { gt: 0 },
          isDeleted: false,
        },
        _sum: { creditAmount: true },
      });

      creditStats.forEach((stat) => {
        if (stat.customerId) {
          customerCreditMap.set(stat.customerId, stat._sum.creditAmount || 0);
        }
      });
    }

    // Enrich entries with calculated total credit
    const enrichedEntries = entries.map((entry) => {
      if (!entry.customer) return entry;

      const entryCredit = customerCreditMap.get(entry.customer.id) || 0;
      const manualCredit = entry.customer.pendingCredit || 0;
      const totalCredit = manualCredit + entryCredit;

      return {
        ...entry,
        customer: {
          ...entry.customer,
          pendingCredit: totalCredit,
        },
      };
    });

    // Get all entries (including active)
    const totalEntries = enrichedEntries.length;

    // Get active entries count
    const activeEntries = enrichedEntries.filter((entry) => !entry.endTime).length;

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

    const sessionCash = cashData._sum.cashAmount || 0;
    const sessionOnline = onlineData._sum.onlineAmount || 0;
    const creditRevenue = creditData._sum.creditAmount || 0;

    // Credit settled and memberships sold today are real money in the drawer today
    const [other, creditPayments, membershipSales] = await Promise.all([
      getOtherCollections(this.prisma, dayWindow),
      this.prisma.creditPayment.findMany({
        where: { createdAt: dayWindow, addedToEntryTotals: false },
        include: { customer: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customerMembership.findMany({
        where: { purchaseDate: dayWindow, status: { not: 'cancelled' } },
        include: {
          customer: { select: { id: true, name: true } },
          plan: { select: { name: true } },
        },
        orderBy: { purchaseDate: 'desc' },
      }),
    ]);

    const cashRevenue = sessionCash + other.cash;
    const onlineRevenue = sessionOnline + other.online;
    const totalRevenue = cashRevenue + onlineRevenue;
    // The day's business: every bill raised today (paid, unpaid or on credit) plus
    // memberships sold. Credit settled for older sessions is not new business.
    const billedAmount = enrichedEntries.reduce((sum, e) => sum + (e.finalAmount || 0), 0);
    const membershipSold = other.membershipCash + other.membershipOnline;

    // Fix: Fill in missing duration if start and end times exist
    const processedEntries = enrichedEntries.map((entry) => {
      if ((!entry.duration || entry.duration === 0) && entry.startTime && entry.endTime) {
        const start = new Date(entry.startTime);
        const end = new Date(entry.endTime);
        const diffMs = end.getTime() - start.getTime();
        const diffMins = Math.ceil(diffMs / 60000);
        return { ...entry, duration: diffMins > 0 ? diffMins : 0 };
      }
      return entry;
    });

    return {
      entries: processedEntries,
      summary: {
        totalRevenue,
        dayBusiness: billedAmount + membershipSold,
        billedAmount,
        cashRevenue,
        onlineRevenue,
        creditRevenue,
        totalEntries,
        activeEntries,
        sessionRevenue: sessionCash + sessionOnline,
        sessionCash,
        sessionOnline,
        creditCollected: other.creditCash + other.creditOnline,
        creditCollectedCash: other.creditCash,
        creditCollectedOnline: other.creditOnline,
        membershipSales: membershipSold,
        membershipCash: other.membershipCash,
        membershipOnline: other.membershipOnline,
      },
      collections: {
        creditPayments: creditPayments.map((p) => ({
          id: p.id,
          customer: p.customer,
          cashAmount: p.cashAmount,
          onlineAmount: p.onlineAmount,
          totalAmount: p.totalAmount,
          notes: p.notes,
          createdAt: p.createdAt,
        })),
        membershipSales: membershipSales.map((m) => ({
          id: m.id,
          customer: m.customer,
          planName: m.plan?.name,
          paymentMode: m.paymentMode,
          paymentAmount: m.paymentAmount,
          purchaseDate: m.purchaseDate,
        })),
      },
    };
  }

  async update(id: string, updateData: any) {
    const entry = await this.findOne(id);

    // When the bill has menu items, the snacks amount comes from them (PUT /items)
    if (updateData.beveragesAmount !== undefined && (entry as any).items?.length) {
      delete updateData.beveragesAmount;
    }

    // Prepare the data to update
    const dataToUpdate = { ...updateData };

    // Check if any amount-related fields are being updated
    const needsRecalculation =
      updateData.predefinedDuration !== undefined ||
      updateData.beveragesAmount !== undefined ||
      updateData.discount !== undefined;

    // If predefinedDuration is being updated, recalculate cost
    if (updateData.predefinedDuration !== undefined) {
      const machineId = updateData.machineId || entry.machineId;
      const predefinedDuration = updateData.predefinedDuration;
      const pcNumber = updateData.pcNumber || entry.pcNumber;

      if (predefinedDuration && predefinedDuration > 0) {
        const roundedDuration = this.machinesService.roundDuration(predefinedDuration);
        const calculatedCost = await this.machinesService.calculateSessionCost(machineId, roundedDuration, pcNumber);

        dataToUpdate.cost = calculatedCost;
        dataToUpdate.roundedDuration = roundedDuration;
        dataToUpdate.duration = predefinedDuration; // Update actual duration field

        const startTime = new Date(updateData.startTime || entry.startTime);
        const newEndTime = new Date(startTime.getTime() + predefinedDuration * 60_000);

        if (entry.endTime && entry.autoEnded && newEndTime > new Date()) {
          // The cron auto-ended this session at its old limit and the operator is
          // now extending it: reopen it, otherwise it stays "ended" with an end
          // time in the future and never alerts or auto-ends again.
          dataToUpdate.endTime = null;
          dataToUpdate.autoEnded = false;
        } else if (entry.endTime) {
          // If session has ended, recalculate endTime based on new duration
          dataToUpdate.endTime = newEndTime;
        }

        // Membership sessions pay in hours: charge/refund the difference
        if (entry.membershipId && predefinedDuration !== entry.predefinedDuration) {
          const deltaHours = (predefinedDuration - (entry.predefinedDuration || 0)) / 60;
          if (deltaHours > 0) {
            await this.membershipsService.deductHours(entry.membershipId, deltaHours);
          } else {
            await this.membershipsService.refundHours(entry.membershipId, -deltaHours);
          }
          dataToUpdate.membershipHours = predefinedDuration / 60;
        }
      }
    }

    // Membership play time is never charged in money
    if (entry.membershipId && updateData.finalAmount === undefined) {
      dataToUpdate.finalAmount = entry.finalAmount || 0;
    }

    // Recalculate finalAmount if beverages, discount, or duration changed
    // But only if client didn't explicitly provide finalAmount
    if (needsRecalculation && updateData.finalAmount === undefined && !entry.membershipId) {
      const effectiveCost = dataToUpdate.cost !== undefined
        ? dataToUpdate.cost
        : entry.cost || 0;
      const beveragesAmount = updateData.beveragesAmount !== undefined
        ? updateData.beveragesAmount
        : entry.beveragesAmount || 0;
      const discountAmount = updateData.discount !== undefined
        ? updateData.discount
        : entry.discount || 0;
      dataToUpdate.finalAmount = Math.max(0, effectiveCost - discountAmount) + beveragesAmount;
    }
    // If finalAmount IS provided by client, use it as-is (already includes beverages and discount)

    // Auto-calculate payment status if amounts are changed
    const effectiveFinalAmount =
      dataToUpdate.finalAmount !== undefined
        ? dataToUpdate.finalAmount
        : entry.finalAmount;

    const effectiveCash =
      dataToUpdate.cashAmount !== undefined
        ? dataToUpdate.cashAmount
        : entry.cashAmount;
    const effectiveOnline =
      dataToUpdate.onlineAmount !== undefined
        ? dataToUpdate.onlineAmount
        : entry.onlineAmount;
    const effectiveCredit =
      dataToUpdate.creditAmount !== undefined
        ? dataToUpdate.creditAmount
        : entry.creditAmount;

    // Check if we need to update status (if any of these changed or if status is currently unpaid/partial)
    const amountsChanged =
      dataToUpdate.cashAmount !== undefined ||
      dataToUpdate.onlineAmount !== undefined ||
      dataToUpdate.creditAmount !== undefined ||
      dataToUpdate.finalAmount !== undefined ||
      updateData.predefinedDuration !== undefined;

    if (amountsChanged && effectiveFinalAmount !== undefined) {
      const totalPaid = effectiveCash + effectiveOnline + effectiveCredit + (entry.creditPaid || 0);
      dataToUpdate.paymentStatus = paymentStatusFor(totalPaid, effectiveFinalAmount);
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
            controllerRates: true,
          },
        },
      },
    });
  }

  /**
   * Replace the snacks/drinks on a session. Stock moves by the difference,
   * the snacks amount is recalculated and the bill follows it.
   */
  async setItems(id: string, inputs: EntryItemInputDto[]) {
    const entry = await this.prisma.entry.findUnique({ where: { id }, include: { items: true } });
    if (!entry) throw new NotFoundException('Entry not found');
    if (entry.isDeleted) throw new BadRequestException('Entry is deleted');

    await this.prisma.$transaction(async (tx) => {
      const before: ItemLine[] = entry.items.map((i) => ({
        productId: i.productId, name: i.name, unitPrice: i.unitPrice, unitCost: i.unitCost, quantity: i.quantity, total: i.total,
      }));
      const after = await this.productsService.buildLines(tx, inputs, before);
      await this.productsService.applyStockDiff(tx, id, before, after);
      await tx.entryItem.deleteMany({ where: { entryId: id } });
      if (after.length) await tx.entryItem.createMany({ data: after.map((l) => ({ ...l, entryId: id })) });

      const newBeverages = after.reduce((sum, l) => sum + l.total, 0);
      const delta = newBeverages - (entry.beveragesAmount || 0);
      let finalAmount = entry.finalAmount;
      if (entry.membershipId) finalAmount = newBeverages; // play is covered by hours
      else if (entry.finalAmount > 0) finalAmount = Math.max(0, entry.finalAmount + delta);
      else if (entry.endTime) finalAmount = newBeverages;
      // Open-ended running sessions keep 0; ending adds the snacks amount

      const totalPaid = entry.cashAmount + entry.onlineAmount + entry.creditAmount + (entry.creditPaid || 0);
      await tx.entry.update({
        where: { id },
        data: {
          beveragesAmount: newBeverages,
          finalAmount,
          ...((entry.endTime || entry.membershipId) && { paymentStatus: paymentStatusFor(totalPaid, finalAmount) }),
        },
      });
    });

    return this.findOne(id);
  }

  async softDelete(id: string) {
    const entry = await this.findOne(id);

    // Note: pendingCredit is calculated dynamically from entries, no need to update customer table

    // Give the membership its hours back; they were deducted when the entry was created
    if (!entry.isDeleted && entry.membershipId && entry.membershipHours) {
      await this.membershipsService.refundHours(entry.membershipId, entry.membershipHours);
    }
    // Snacks go back on the shelf
    if (!entry.isDeleted) await this.productsService.moveEntryStock(id, 'return');

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
            controllerRates: true,
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
              controllerRates: true,
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

    // Re-take the hours and stock returned on soft delete
    if (entry.membershipId && entry.membershipHours) {
      await this.membershipsService.deductHours(entry.membershipId, entry.membershipHours);
    }
    await this.productsService.moveEntryStock(id, 'sale');

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

    // Soft-deleted entries were already refunded
    if (!entry.isDeleted && entry.membershipId && entry.membershipHours) {
      await this.membershipsService.refundHours(entry.membershipId, entry.membershipHours);
    }
    if (!entry.isDeleted) await this.productsService.moveEntryStock(id, 'return');

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
      updatePaymentDto.creditAmount +
      (entry.creditPaid || 0);

    const paymentStatus = paymentStatusFor(totalPaid, entry.finalAmount);

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
            controllerRates: true,
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

    // Date filtering by session start (local calendar days; endDate inclusive).
    // createdAt put backdated entries on the day they were typed in.
    if (date) {
      where.startTime = dayRange(date);
    } else if (startDate && endDate) {
      where.startTime = dateRange(startDate, endDate);
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
        const calculatedCost = await this.machinesService.calculateSessionCost(entry.machineId, roundedDuration, entry.pcNumber);

        // Keep the amount agreed at create (it may have been edited by the operator);
        // recalculate only when none was stored. Membership sessions stay at 0.
        const discount = entry.discount || 0;
        const beveragesAmount = entry.beveragesAmount || 0;
        const finalAmountWithAdjustments = entry.membershipId || entry.finalAmount > 0
          ? entry.finalAmount
          : Math.max(0, calculatedCost - discount) + beveragesAmount;

        // Pass the complete final amount (play cost - discount + beverages)
        const ended = await this.endEntry(
          entry.id,
          {
            endTime: expectedEnd.toISOString(),
            paymentType: 'credit', // Legacy field
            finalAmount: finalAmountWithAdjustments,
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
