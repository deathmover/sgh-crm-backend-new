import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsDateString,
  Min,
  IsString,
  IsIn,
  IsOptional,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ToRupees } from '../../../common/decorators/to-rupees.decorator';

export class EndEntryDto {
  @ApiProperty({ example: '2025-09-30T12:30:00Z' })
  @IsDateString()
  @IsNotEmpty()
  endTime: string;

  @ApiPropertyOptional({
    example: 150,
    description: 'Admin can override the calculated final amount',
  })
  // Was @IsInt(), which rejected any amount with paise; now rounded to whole rupees
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  @ToRupees()
  finalAmount?: number;

  // 'membership' is what the UI sends for membership sessions; it used to be
  // rejected, so those sessions could never be ended manually.
  @ApiProperty({ example: 'cash', enum: ['cash', 'online', 'credit', 'membership'] })
  @IsString()
  @IsNotEmpty()
  @IsIn(['cash', 'online', 'credit', 'membership'])
  paymentType: string;

  // Split payment fields (optional)
  @ApiPropertyOptional({ example: 100, description: 'Amount paid in cash' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  @ToRupees()
  cashAmount?: number;

  @ApiPropertyOptional({ example: 50, description: 'Amount paid online' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  @ToRupees()
  onlineAmount?: number;

  @ApiPropertyOptional({ example: 0, description: 'Amount in credit' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  @ToRupees()
  creditAmount?: number;

  @ApiPropertyOptional({ example: 'Applied 10% discount' })
  @IsString()
  @IsOptional()
  notes?: string;
}
