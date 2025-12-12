import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { PrismaService } from '../../config/database.config';
import { MachinesModule } from '../machines/machines.module';

@Module({
  imports: [MachinesModule],
  controllers: [BookingsController],
  providers: [BookingsService, PrismaService],
  exports: [BookingsService],
})
export class BookingsModule {}
