import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePartnerLoanDto {
  @ApiProperty({ example: 'Ravi Parmar' })
  @IsString()
  partnerName: string;

  @ApiProperty({ example: 5000 })
  @IsNumber() @Min(0)
  amount: number;

  @ApiProperty({ example: 'borrow', description: 'borrow | repay' })
  @IsIn(['borrow', 'repay'])
  type: string;

  @ApiProperty({ example: '2026-05-01' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  notes?: string;
}
