import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested, IsString, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class ImportCustomerDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiProperty({ example: '9876543210' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'john@example.com', required: false })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: 500, required: false, description: 'Initial credit amount' })
  @IsNumber()
  @IsOptional()
  creditAmount?: number;

  @ApiProperty({ example: 'VIP customer', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class BulkImportCustomersDto {
  @ApiProperty({ type: [ImportCustomerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportCustomerDto)
  customers: ImportCustomerDto[];
}
