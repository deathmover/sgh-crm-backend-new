import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, IsEnum } from 'class-validator';

export enum BookingStatusEnum {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CHECKED_IN = 'CHECKED_IN',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export class BookingQueryDto {
  @ApiPropertyOptional({ example: '2025-12-15', description: 'Filter by specific booking date (YYYY-MM-DD)' })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({ example: '2025-12-01', description: 'Start date range (YYYY-MM-DD)' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ example: '2025-12-31', description: 'End date range (YYYY-MM-DD)' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ enum: BookingStatusEnum, example: BookingStatusEnum.CONFIRMED })
  @IsEnum(BookingStatusEnum)
  @IsOptional()
  status?: BookingStatusEnum;

  @ApiPropertyOptional({ example: 'clxxx...customer-id' })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({ example: 'clxxx...machine-id' })
  @IsString()
  @IsOptional()
  machineId?: string;
}
