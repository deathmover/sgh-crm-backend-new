import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelBookingDto {
  @ApiPropertyOptional({ example: 'Customer requested cancellation' })
  @IsString()
  @IsOptional()
  reason?: string;
}
