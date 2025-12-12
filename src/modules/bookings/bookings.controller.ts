import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { BookingQueryDto } from './dto/booking-query.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';

@ApiTags('bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new booking' })
  @ApiResponse({ status: 201, description: 'Booking created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed or outside booking window' })
  @ApiResponse({ status: 409, description: 'Conflict - time slot unavailable' })
  create(@Body() createBookingDto: CreateBookingDto) {
    return this.bookingsService.create(createBookingDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all bookings with optional filters' })
  @ApiResponse({ status: 200, description: 'List of bookings' })
  findAll(@Query() query: BookingQueryDto) {
    return this.bookingsService.findAll(query);
  }

  @Get('availability')
  @ApiOperation({ summary: 'Check availability for a time slot' })
  @ApiResponse({ status: 200, description: 'Availability status' })
  checkAvailability(
    @Query('machineId') machineId: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
    @Query('pcNumber') pcNumber?: string,
  ) {
    return this.bookingsService.checkAvailability({
      machineId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      pcNumber,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single booking by ID' })
  @ApiResponse({ status: 200, description: 'Booking details' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  findOne(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a booking' })
  @ApiResponse({ status: 200, description: 'Booking updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - cannot update booking with this status' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  @ApiResponse({ status: 409, description: 'Conflict - new time slot unavailable' })
  update(@Param('id') id: string, @Body() updateBookingDto: UpdateBookingDto) {
    return this.bookingsService.update(id, updateBookingDto);
  }

  @Post(':id/check-in')
  @ApiOperation({ summary: 'Check in a booking and create an entry' })
  @ApiResponse({
    status: 200,
    description: 'Booking checked in and entry created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request - cannot check in booking with this status' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  checkIn(@Param('id') id: string) {
    return this.bookingsService.checkIn(id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a booking' })
  @ApiResponse({ status: 200, description: 'Booking cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - cannot cancel booking with this status' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  cancel(@Param('id') id: string, @Body() cancelBookingDto: CancelBookingDto) {
    return this.bookingsService.cancel(id, cancelBookingDto);
  }
}
