import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ToRupees } from '../../../common/decorators/to-rupees.decorator';

export const PRODUCT_CATEGORIES = ['drinks', 'snacks', 'food', 'other'];

export class CreateProductDto {
  @ApiProperty({ example: 'Coke 250ml' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'drinks', enum: PRODUCT_CATEGORIES })
  @IsOptional()
  @IsIn(PRODUCT_CATEGORIES)
  category?: string;

  @ApiProperty({ example: 40, description: 'Selling price (₹)' })
  @Type(() => Number)
  @ToRupees()
  @IsInt()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 25, description: 'Purchase cost (₹)' })
  @IsOptional()
  @Type(() => Number)
  @ToRupees()
  @IsInt()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional({ example: 24, description: 'Opening stock' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  stock?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowStockLevel?: number;
}

// Stock is changed through restock/sales, not by editing the product
export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class RestockDto {
  @ApiProperty({ example: 24, description: 'Units added (negative to correct a miscount)' })
  @Type(() => Number)
  @IsInt()
  quantity: number;

  @ApiPropertyOptional({ example: 25, description: 'Update cost price for this batch' })
  @IsOptional()
  @Type(() => Number)
  @ToRupees()
  @IsInt()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class EntryItemInputDto {
  @ApiPropertyOptional({ description: 'Menu product; omit for an "Other" amount' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ example: 'Other', description: 'Only for lines without a product' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 50, description: 'Only for lines without a product' })
  @IsOptional()
  @Type(() => Number)
  @ToRupees()
  @IsInt()
  @Min(0)
  unitPrice?: number;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}

export class SetEntryItemsDto {
  @ApiProperty({ type: [EntryItemInputDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => EntryItemInputDto)
  items: EntryItemInputDto[];
}
