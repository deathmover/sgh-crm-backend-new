import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class FinancialAnalysisQueryDto {
  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ example: '2025-01-31' })
  @IsString()
  @IsOptional()
  endDate?: string;
}
