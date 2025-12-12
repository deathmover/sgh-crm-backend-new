import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../config/database.config';
import { MachinesService } from '../machines/machines.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { BookingQueryDto } from './dto/booking-query.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private machinesService: MachinesService,
  ) {}

  async create(createBookingDto: CreateBookingDto) {
    const {
      customerId,
      machineId,
      pcNumber,
      startTime,
      endTime,
      duration,
      advancePayment,
      cashAmount,
      onlineAmount,
      creditAmount,
      discount,
      notes,
    } = createBookingDto;

    // Verify customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Verify machine exists
    const machine = await this.prisma.machine.findUnique({
      where: { id: machineId },
    });
    if (!machine) {
      throw new NotFoundException('Machine not found');
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    const now = new Date();

    // Validate 3-day booking window
    const maxBookingDate = new Date();
    maxBookingDate.setDate(maxBookingDate.getDate() + 3);
    maxBookingDate.setHours(23, 59, 59, 999);

    if (start <= now) {
      throw new BadRequestException('Booking start time must be in the future');
    }

    if (start > maxBookingDate) {
      throw new BadRequestException(
        'Bookings can only be made up to 3 days in advance',
      );
    }

    if (end <= start) {
      throw new BadRequestException('End time must be after start time');
    }

    // Note: Slot availability check removed as per requirements
    // Bookings can be made even if time slots overlap

    // Calculate booking date (just the date part of startTime)
    const bookingDate = new Date(start);
    bookingDate.setHours(0, 0, 0, 0);

    // Create booking
    return this.prisma.booking.create({
      data: {
        customerId,
        machineId,
        pcNumber,
        bookingDate,
        startTime: start,
        endTime: end,
        duration,
        advancePayment: advancePayment || false,
        cashAmount: cashAmount || 0,
        onlineAmount: onlineAmount || 0,
        creditAmount: creditAmount || 0,
        discount: discount || 0,
        notes,
        status: 'CONFIRMED', // Auto-confirm as per requirements
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

  async findAll(query: BookingQueryDto) {
    const { date, startDate, endDate, status, customerId, machineId } = query;

    const where: any = {};

    // Filter by specific date
    if (date) {
      const dateObj = new Date(date);
      dateObj.setHours(0, 0, 0, 0);
      const nextDay = new Date(dateObj);
      nextDay.setDate(nextDay.getDate() + 1);

      where.bookingDate = {
        gte: dateObj,
        lt: nextDay,
      };
    }

    // Filter by date range
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      where.bookingDate = {
        gte: start,
        lte: end,
      };
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Filter by customer
    if (customerId) {
      where.customerId = customerId;
    }

    // Filter by machine
    if (machineId) {
      where.machineId = machineId;
    }

    return this.prisma.booking.findMany({
      where,
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        machine: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        entry: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            finalAmount: true,
          },
        },
      },
      orderBy: [{ bookingDate: 'asc' }, { startTime: 'asc' }],
    });
  }

  async findOne(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, email: true },
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
        entry: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  async update(id: string, updateBookingDto: UpdateBookingDto) {
    const booking = await this.findOne(id);

    // Only allow updating CONFIRMED bookings
    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException(
        `Cannot update booking with status ${booking.status}`,
      );
    }

    const {
      machineId,
      pcNumber,
      startTime,
      endTime,
      duration,
      notes,
      cashAmount,
      onlineAmount,
      creditAmount,
      discount,
    } = updateBookingDto;

    // Note: Slot availability check removed as per requirements
    // Bookings can be updated even if time slots overlap

    return this.prisma.booking.update({
      where: { id },
      data: {
        ...(machineId && { machineId }),
        ...(pcNumber !== undefined && { pcNumber }),
        ...(startTime && { startTime: new Date(startTime) }),
        ...(endTime && { endTime: new Date(endTime) }),
        ...(duration && { duration }),
        ...(notes !== undefined && { notes }),
        ...(cashAmount !== undefined && { cashAmount }),
        ...(onlineAmount !== undefined && { onlineAmount }),
        ...(creditAmount !== undefined && { creditAmount }),
        ...(discount !== undefined && { discount }),
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
          },
        },
      },
    });
  }

  async checkIn(id: string) {
    const booking = await this.findOne(id);

    // Verify booking is in CONFIRMED status
    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException(
        `Cannot check in booking with status ${booking.status}`,
      );
    }

    // Calculate estimated cost and final amount
    const roundedDuration = this.machinesService.roundDuration(booking.duration);
    let estimatedCost = await this.machinesService.calculateCost(
      booking.machineId,
      roundedDuration,
    );

    // For PS5 machines, multiply by number of controllers
    if (booking.machine.type === 'ps5' && booking.pcNumber) {
      const controllers = parseInt(booking.pcNumber) || 1;
      estimatedCost = estimatedCost * (controllers > 0 ? controllers : 1);
    }

    // Calculate final amount: (cost - discount)
    const finalAmount = Math.max(0, estimatedCost - booking.discount);

    // Create entry from booking
    const entry = await this.prisma.entry.create({
      data: {
        customerId: booking.customerId,
        machineId: booking.machineId,
        pcNumber: booking.pcNumber,
        startTime: new Date(), // Start now
        predefinedDuration: booking.duration,
        roundedDuration,
        cost: estimatedCost,
        discount: booking.discount,
        finalAmount,
        cashAmount: booking.cashAmount,
        onlineAmount: booking.onlineAmount,
        creditAmount: booking.creditAmount,
        paymentStatus:
          booking.cashAmount + booking.onlineAmount + booking.creditAmount > 0
            ? 'partial'
            : null,
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
          },
        },
      },
    });

    // Update booking status and link to entry
    const updatedBooking = await this.prisma.booking.update({
      where: { id },
      data: {
        status: 'CHECKED_IN',
        checkedInAt: new Date(),
        entryId: entry.id,
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
          },
        },
        entry: true,
      },
    });

    return {
      booking: updatedBooking,
      entry,
    };
  }

  async cancel(id: string, cancelBookingDto: CancelBookingDto) {
    const booking = await this.findOne(id);

    // Can only cancel CONFIRMED bookings
    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException(
        `Cannot cancel booking with status ${booking.status}`,
      );
    }

    return this.prisma.booking.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        notes: cancelBookingDto.reason
          ? `${booking.notes || ''}\nCancellation reason: ${cancelBookingDto.reason}`.trim()
          : booking.notes,
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
          },
        },
      },
    });
  }

  async checkAvailability(params: {
    machineId: string;
    startTime: Date;
    endTime: Date;
    pcNumber?: string;
    excludeBookingId?: string;
  }): Promise<{
    available: boolean;
    conflicts?: Array<{
      type: 'booking' | 'entry';
      id: string;
      startTime?: Date;
      endTime?: Date;
    }>;
  }> {
    const { machineId, startTime, endTime, pcNumber, excludeBookingId } =
      params;

    // Check for conflicting bookings
    const potentialConflictingBookings = await this.prisma.booking.findMany({
      where: {
        machineId,
        ...(pcNumber && { pcNumber }),
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        ...(excludeBookingId && { id: { not: excludeBookingId } }),
        OR: [
          {
            // Booking starts during our time slot
            AND: [
              { startTime: { gte: startTime } },
              { startTime: { lt: endTime } },
            ],
          },
          {
            // Booking ends during our time slot
            AND: [
              { endTime: { gt: startTime } },
              { endTime: { lte: endTime } },
            ],
          },
          {
            // Booking completely overlaps our time slot
            AND: [
              { startTime: { lte: startTime } },
              { endTime: { gte: endTime } },
            ],
          },
        ],
      },
      include: {
        entry: true, // Include entry to check if it has ended
      },
    });

    // Filter out bookings whose entries have already ended
    const conflictingBookings = potentialConflictingBookings.filter((booking) => {
      // CONFIRMED bookings are always conflicts
      if (booking.status === 'CONFIRMED') {
        return true;
      }
      // CHECKED_IN bookings: only conflict if entry hasn't ended yet
      if (booking.status === 'CHECKED_IN' && booking.entry) {
        return booking.entry.endTime === null; // Only conflict if entry is still active
      }
      return true; // Include by default if unsure
    });

    // Check for active entries (ongoing sessions)
    const activeEntries = await this.prisma.entry.findMany({
      where: {
        machineId,
        ...(pcNumber && { pcNumber }),
        endTime: null,
        isDeleted: false,
      },
    });

    // Filter active entries that would actually conflict with the booking time
    // An active entry conflicts if its expected end time would be after the booking start time
    const conflictingEntries = activeEntries.filter((entry) => {
      // If entry has predefinedDuration, calculate expected end time
      if (entry.predefinedDuration) {
        const expectedEndTime = new Date(
          entry.startTime.getTime() + entry.predefinedDuration * 60000,
        );
        // Entry conflicts if it would still be running when booking starts
        return expectedEndTime > startTime;
      }
      // If no predefined duration, we can't predict when it will end
      // So we consider it a potential conflict (conservative approach)
      return true;
    });

    const available =
      conflictingBookings.length === 0 && conflictingEntries.length === 0;

    const conflicts = [
      ...conflictingBookings.map((b) => ({
        type: 'booking' as const,
        id: b.id,
        startTime: b.startTime,
        endTime: b.endTime,
      })),
      ...conflictingEntries.map((e) => ({
        type: 'entry' as const,
        id: e.id,
        startTime: e.startTime,
        endTime: e.endTime || undefined,
      })),
    ];

    return {
      available,
      ...(conflicts.length > 0 && { conflicts }),
    };
  }
}
