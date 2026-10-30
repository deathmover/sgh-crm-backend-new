import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsOptional,
  IsNumber,
  IsPositive,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { EntryItemInputDto } from '../../products/dto/product.dto';
import { ToRupees } from '../../../common/decorators/to-rupees.decorator';

export class CreateEntryDto {
  @ApiProperty({ example: 'clxxx...customer-id' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ example: 'clxxx...machine-id' })
  @IsString()
  @IsNotEmpty()
  machineId: string;

  @ApiProperty({ example: '2025-09-30T10:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @ApiPropertyOptional({ example: 60, description: 'Expected duration in minutes' })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  predefinedDuration?: number;

  @ApiPropertyOptional({ example: 100, description: 'Advance cash payment' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  @ToRupees()
  cashAmount?: number;

  @ApiPropertyOptional({ example: 50, description: 'Advance online payment' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  @ToRupees()
  onlineAmount?: number;

  @ApiPropertyOptional({ example: 0, description: 'Advance credit amount' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  @ToRupees()
  creditAmount?: number;

  @ApiPropertyOptional({ example: 'PC-5', description: 'PC/Machine unit number' })
  @IsString()
  @IsOptional()
  pcNumber?: string;

  @ApiPropertyOptional({ example: 20, description: 'Discount applied' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  @ToRupees()
  discount?: number;

  @ApiPropertyOptional({ example: 50, description: 'Total beverages cost' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  @ToRupees()
  beveragesAmount?: number;

  @ApiPropertyOptional({ example: 'Customer requested mid-end PC' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ example: 180, description: 'Operator-adjusted total (play - discount + beverages); overrides the calculated amount' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  @ToRupees()
  finalAmount?: number;

  @ApiPropertyOptional({ type: [EntryItemInputDto], description: 'Snacks/drinks; their total becomes beveragesAmount' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => EntryItemInputDto)
  items?: EntryItemInputDto[];

  @ApiPropertyOptional({ example: 'clxxx...membership-id', description: 'Use hours from this membership (optional)' })
  @IsString()
  @IsOptional()
  useMembershipId?: string;
}
