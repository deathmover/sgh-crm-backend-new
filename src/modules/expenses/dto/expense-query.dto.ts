import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString } from 'class-validator';

export class ExpenseQueryDto {
  @ApiPropertyOptional({ example: 'rent' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: '2025-10-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2025-10-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 'cash' })
  @IsOptional()
  @IsString()
  paymentMode?: string;
}
