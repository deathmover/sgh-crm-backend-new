import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsPositive, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateEntryDto {
  @ApiPropertyOptional({ example: 'clxxx...customer-id' })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({ example: 'clxxx...machine-id' })
  @IsString()
  @IsOptional()
  machineId?: string;

  @ApiPropertyOptional({ example: '2025-09-30T10:00:00Z' })
  @IsDateString()
  @IsOptional()
  startTime?: string;

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

  @ApiPropertyOptional({ example: '{"Cold Drink": 2, "Chips": 1}', description: 'Beverages sold' })
  @IsOptional()
  beverages?: any;

  @ApiPropertyOptional({ example: 50, description: 'Total beverages cost' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  beveragesAmount?: number;

  @ApiPropertyOptional({ example: 20, description: 'Discount applied' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  discount?: number;

  @ApiPropertyOptional({ example: 150, description: 'Final amount (for ended sessions)' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  finalAmount?: number;

  @ApiPropertyOptional({ example: 'Updated notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}