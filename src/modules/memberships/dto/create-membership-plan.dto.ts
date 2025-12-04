import { IsString, IsNumber, IsBoolean, IsOptional, Min } from 'class-validator';

export class CreateMembershipPlanDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  hours: number;

  @IsNumber()
  @Min(1)
  validityDays: number;

  @IsOptional()
  @IsString()
  machineType?: string = 'mid_pro';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @IsOptional()
  @IsNumber()
  displayOrder?: number = 0;
}
