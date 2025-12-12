import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsDateString,
  IsNumber,
  IsPositive,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateBookingDto {
  @ApiPropertyOptional({ example: 'clxxx...machine-id' })
  @IsString()
  @IsOptional()
  machineId?: string;

  @ApiPropertyOptional({ example: 'PC-5', description: 'PC/Machine unit number' })
  @IsString()
  @IsOptional()
  pcNumber?: string;

  @ApiPropertyOptional({ example: '2025-12-15T14:00:00Z' })
  @IsDateString()
  @IsOptional()
  startTime?: string;

  @ApiPropertyOptional({ example: '2025-12-15T16:00:00Z' })
  @IsDateString()
  @IsOptional()
  endTime?: string;

  @ApiPropertyOptional({ example: 120, description: 'Duration in minutes' })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  duration?: number;

  @ApiPropertyOptional({ example: 'Updated notes' })
  @IsString()
  @IsOptional()
  notes?: string;

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
}
