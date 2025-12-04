import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MachineResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  units: number;

  @ApiProperty()
  hourlyRate: number;

  @ApiPropertyOptional()
  halfHourlyRate?: number;

  @ApiPropertyOptional()
  packageRates?: Record<string, number>;

  @ApiProperty()
  createdAt: Date;
}
