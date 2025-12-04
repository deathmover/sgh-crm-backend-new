import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class PurchaseMembershipDto {
  @IsString()
  customerId: string;

  @IsString()
  planId: string;

  @IsOptional()
  @IsString()
  paymentMode?: string = 'cash'; // cash | online

  @IsOptional()
  @IsNumber()
  @Min(0)
  paymentAmount?: number; // Optional: if different from plan price (discounts, etc.)

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  createdBy?: string; // Admin username
}
