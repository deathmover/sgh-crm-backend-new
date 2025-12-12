import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsOptional,
  IsNumber,
  IsPositive,
  IsBoolean,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBookingDto {
  @ApiProperty({ example: 'clxxx...customer-id' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ example: 'clxxx...machine-id' })
  @IsString()
  @IsNotEmpty()
  machineId: string;

  @ApiPropertyOptional({ example: 'PC-5', description: 'PC/Machine unit number' })
  @IsString()
  @IsOptional()
  pcNumber?: string;

  @ApiProperty({ example: '2025-12-15T14:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @ApiProperty({ example: '2025-12-15T16:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  endTime: string;

  @ApiProperty({ example: 120, description: 'Duration in minutes' })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  duration: number;

  @ApiPropertyOptional({ example: true, description: 'Whether advance payment is collected' })
  @IsBoolean()
  @IsOptional()
  advancePayment?: boolean;

  @ApiPropertyOptional({ example: 100, description: 'Advance cash payment' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  cashAmount?: number;

  @ApiPropertyOptional({ example: 50, description: 'Advance online payment' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  onlineAmount?: number;

  @ApiPropertyOptional({ example: 0, description: 'Advance credit amount' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  creditAmount?: number;

  @ApiPropertyOptional({ example: 20, description: 'Discount applied' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  discount?: number;

  @ApiPropertyOptional({ example: 'Customer requested specific machine' })
  @IsString()
  @IsOptional()
  notes?: string;
}
