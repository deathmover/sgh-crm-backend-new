import { IsString, IsOptional, IsNumber, Min, IsIn } from 'class-validator';

export class PurchaseMembershipDto {
  @IsString()
  customerId: string;

  @IsString()
  planId: string;

  @IsOptional()
  @IsIn(['cash', 'online', 'split'])
  paymentMode?: string = 'cash'; // cash | online | split (decided from the parts when they're given)

  /** Part paid in cash; with onlineAmount, must add up to paymentAmount */
  @IsOptional()
  @IsNumber()
  @Min(0)
  cashAmount?: number;

  /** Part paid online */
  @IsOptional()
  @IsNumber()
  @Min(0)
  onlineAmount?: number;

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
