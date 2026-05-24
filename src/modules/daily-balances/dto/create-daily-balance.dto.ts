import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateDailyBalanceDto {
  @ApiProperty({ example: '2026-05-01' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ example: 3040 })
  @IsNumber() @IsOptional() @Min(0)
  cashOpening?: number;

  @ApiPropertyOptional({ example: 149981 })
  @IsNumber() @IsOptional() @Min(0)
  onlineOpening?: number;

  @ApiPropertyOptional({ example: 4000 })
  @IsNumber() @IsOptional() @Min(0)
  homeCashOpening?: number;

  @ApiPropertyOptional({ example: 8505 })
  @IsNumber() @IsOptional() @Min(0)
  daysTotal?: number;

  @ApiPropertyOptional({ example: 36663 })
  @IsNumber() @IsOptional()
  remaining?: number;

  @ApiPropertyOptional({ example: 2670 })
  @IsNumber() @IsOptional() @Min(0)
  cashClosing?: number;

  @ApiPropertyOptional({ example: 149981 })
  @IsNumber() @IsOptional() @Min(0)
  onlineClosing?: number;

  @ApiPropertyOptional({ example: 8000 })
  @IsNumber() @IsOptional() @Min(0)
  homeCashClosing?: number;

  @ApiPropertyOptional({ example: 195659 })
  @IsNumber() @IsOptional() @Min(0)
  shahuBankClosing?: number;

  @ApiPropertyOptional({ example: 1200 })
  @IsNumber() @IsOptional()
  profitLoss?: number;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  notes?: string;
}
