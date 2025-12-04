import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePaymentDto {
  @ApiProperty({ example: 100, description: 'Amount paid in cash' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  cashAmount: number;

  @ApiProperty({ example: 50, description: 'Amount paid online' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  onlineAmount: number;

  @ApiProperty({ example: 0, description: 'Amount in credit' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  creditAmount: number;

  @ApiPropertyOptional({ example: 'Paid partial amount' })
  @IsString()
  @IsOptional()
  notes?: string;
}
