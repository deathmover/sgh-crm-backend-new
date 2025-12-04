import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
} from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty({
    example: 'rent',
    description:
      'Expense category: rent, electricity, internet, maintenance, salaries, inventory, other',
  })
  @IsString()
  category: string;

  @ApiProperty({ example: 5000, description: 'Expense amount' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ example: 'Monthly shop rent' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '2025-10-01' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({
    example: 'cash',
    description: 'Payment mode: cash, online, card',
  })
  @IsString()
  @IsOptional()
  paymentMode?: string;

  @ApiPropertyOptional({ example: 'Receipt123.pdf' })
  @IsString()
  @IsOptional()
  receipt?: string;

  @ApiPropertyOptional({ example: 'Additional notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}
