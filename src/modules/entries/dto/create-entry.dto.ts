import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsOptional,
  IsNumber,
  IsPositive,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEntryDto {
  @ApiProperty({ example: 'clxxx...customer-id' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ example: 'clxxx...machine-id' })
  @IsString()
  @IsNotEmpty()
  machineId: string;

  @ApiProperty({ example: '2025-09-30T10:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @ApiPropertyOptional({ example: 60, description: 'Expected duration in minutes' })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  predefinedDuration?: number;

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

  @ApiPropertyOptional({ example: 'PC-5', description: 'PC/Machine unit number' })
  @IsString()
  @IsOptional()
  pcNumber?: string;

  @ApiPropertyOptional({ example: 20, description: 'Discount applied' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  discount?: number;

  @ApiPropertyOptional({ example: 50, description: 'Total beverages cost' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  beveragesAmount?: number;

  @ApiPropertyOptional({ example: 'Customer requested mid-end PC' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ example: 'clxxx...membership-id', description: 'Use hours from this membership (optional)' })
  @IsString()
  @IsOptional()
  useMembershipId?: string;
}
