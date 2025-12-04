import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class CreateBankAccountDto {
  @ApiProperty({ example: 'PhonePe Business - Bank 1' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: '1234' })
  @IsString()
  @IsOptional()
  accountNumber?: string;

  @ApiPropertyOptional({ example: 'HDFC Bank' })
  @IsString()
  @IsOptional()
  bankName?: string;

  @ApiProperty({ example: 'online', enum: ['online', 'cash_drawer', 'deposit_account'] })
  @IsString()
  type: string;

  @ApiPropertyOptional({ example: 10000 })
  @IsNumber()
  @IsOptional()
  currentBalance?: number;
}
