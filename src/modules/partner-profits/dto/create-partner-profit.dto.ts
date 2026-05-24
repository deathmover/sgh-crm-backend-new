import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreatePartnerProfitDto {
  @ApiProperty({ example: 5 })
  @IsInt() @Min(1) @Max(12)
  month: number;

  @ApiProperty({ example: 2026 })
  @IsInt() @Min(2020)
  year: number;

  @ApiProperty({ example: 'Ravi Parmar' })
  @IsString()
  partnerName: string;

  @ApiProperty({ example: 15000 })
  @IsNumber() @Min(0)
  amount: number;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  notes?: string;
}
