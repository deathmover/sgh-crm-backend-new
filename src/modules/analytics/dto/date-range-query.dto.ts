import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString } from 'class-validator';

export class DateRangeQueryDto {
  @ApiPropertyOptional({ example: '2025-09-23' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2025-09-30' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
