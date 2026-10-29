import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ToRupees } from '../../../common/decorators/to-rupees.decorator';

// Replaces an inline body type, which the ValidationPipe skipped entirely
// (negative and fractional amounts went straight to the database).
export class PayCreditDto {
  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @ToRupees()
  @IsInt()
  @Min(0)
  cashAmount: number;

  @ApiProperty({ example: 50 })
  @Type(() => Number)
  @ToRupees()
  @IsInt()
  @Min(0)
  onlineAmount: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
