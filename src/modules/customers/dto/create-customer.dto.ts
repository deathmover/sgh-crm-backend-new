import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEmail,
  Matches,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCustomerDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsString()
  @IsOptional()
  @Matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/, {
    message: 'Invalid phone number format',
  })
  phone?: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 0, description: 'Initial credit balance for the customer' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Pending credit must be a positive number' })
  pendingCredit?: number;

  @ApiPropertyOptional({ example: 'VIP customer', description: 'Additional notes about the customer' })
  @IsString()
  @IsOptional()
  notes?: string;
}
