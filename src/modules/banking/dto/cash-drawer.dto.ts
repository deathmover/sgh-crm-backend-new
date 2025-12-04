import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsDateString, IsBoolean } from 'class-validator';

export class CreateCashDrawerDto {
  @ApiProperty({ example: '2025-01-05' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 5000 })
  @IsNumber()
  openingBalance: number;

  @ApiPropertyOptional({ example: 'Opening cash for the day' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CloseCashDrawerDto {
  @ApiProperty({ example: 15000 })
  @IsNumber()
  closingBalance: number;

  @ApiProperty({ example: 8000 })
  @IsNumber()
  depositAmount: number;

  @ApiProperty({ example: 7000 })
  @IsNumber()
  drawerAmount: number;

  @ApiPropertyOptional({ example: 'End of day cash count' })
  @IsString()
  @IsOptional()
  notes?: string;
}
