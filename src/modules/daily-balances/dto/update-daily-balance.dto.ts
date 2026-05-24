import { PartialType } from '@nestjs/swagger';
import { CreateDailyBalanceDto } from './create-daily-balance.dto';

export class UpdateDailyBalanceDto extends PartialType(CreateDailyBalanceDto) {}
