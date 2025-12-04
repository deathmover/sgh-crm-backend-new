import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';

export class CreateTransactionDto {
  @ApiProperty({ example: 'account-id' })
  @IsString()
  accountId: string;

  @ApiProperty({ example: 'credit', enum: ['credit', 'debit', 'transfer'] })
  @IsString()
  type: string;

  @ApiProperty({ example: 5000 })
  @IsNumber()
  amount: number;

  @ApiProperty({ example: 'online_payment', enum: ['online_payment', 'cash_deposit', 'withdrawal', 'expense', 'opening_balance'] })
  @IsString()
  category: string;

  @ApiPropertyOptional({ example: 'Online payment from customer' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'entry-id-123' })
  @IsString()
  @IsOptional()
  referenceId?: string;

  @ApiPropertyOptional({ example: 'entry', enum: ['entry', 'expense', 'manual'] })
  @IsString()
  @IsOptional()
  referenceType?: string;

  @ApiProperty({ example: '2025-01-05' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ example: 'Additional notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}
