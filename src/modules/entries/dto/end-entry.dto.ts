import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsDateString,
  IsInt,
  Min,
  IsString,
  IsIn,
  IsOptional,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class EndEntryDto {
  @ApiProperty({ example: '2025-09-30T12:30:00Z' })
  @IsDateString()
  @IsNotEmpty()
  endTime: string;

  @ApiPropertyOptional({
    example: 150,
    description: 'Admin can override the calculated final amount',
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  finalAmount?: number;

  @ApiProperty({ example: 'cash', enum: ['cash', 'online', 'credit'] })
  @IsString()
  @IsNotEmpty()
  @IsIn(['cash', 'online', 'credit'])
  paymentType: string;

  // Split payment fields (optional)
  @ApiPropertyOptional({ example: 100, description: 'Amount paid in cash' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  cashAmount?: number;

  @ApiPropertyOptional({ example: 50, description: 'Amount paid online' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  onlineAmount?: number;

  @ApiPropertyOptional({ example: 0, description: 'Amount in credit' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  creditAmount?: number;

  @ApiPropertyOptional({ example: 'Applied 10% discount' })
  @IsString()
  @IsOptional()
  notes?: string;
}
