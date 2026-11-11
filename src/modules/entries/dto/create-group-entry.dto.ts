import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ToRupees } from '../../../common/decorators/to-rupees.decorator';
import { EntryItemInputDto } from '../../products/dto/product.dto';

export class GroupSeatDto {
  @ApiProperty({ example: '7' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  pcNumber: string;

  @ApiPropertyOptional({ description: "This player's own customer; the group's customer when left out" })
  @IsString()
  @IsOptional()
  customerId?: string;
}

/** One customer, several PCs: creates one entry per PC, all or nothing. */
export class CreateGroupEntryDto {
  @ApiProperty({ description: 'Customer the group is entered under' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  machineId: string;

  @ApiProperty({ example: '2026-11-11T10:00:00Z' })
  @IsDateString()
  startTime: string;

  @ApiProperty({ type: [GroupSeatDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => GroupSeatDto)
  seats: GroupSeatDto[];

  @ApiPropertyOptional({ example: 60, description: 'Expected duration in minutes (same for every PC)' })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  predefinedDuration?: number;

  @ApiPropertyOptional({ description: 'Play amount per PC; overrides the calculated price' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  @ToRupees()
  amountEach?: number;

  @ApiPropertyOptional({ description: 'Discount per PC' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  @ToRupees()
  discountEach?: number;

  @ApiPropertyOptional({ description: 'Advance cash for the whole group; split across the PCs' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  @ToRupees()
  cashAmount?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  @ToRupees()
  onlineAmount?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  @ToRupees()
  creditAmount?: number;

  @ApiPropertyOptional({ type: [EntryItemInputDto], description: 'Snacks; added to the first PC' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => EntryItemInputDto)
  items?: EntryItemInputDto[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}
