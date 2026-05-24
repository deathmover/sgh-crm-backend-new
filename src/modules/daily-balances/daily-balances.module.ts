import { Module } from '@nestjs/common';
import { DailyBalancesService } from './daily-balances.service';
import { DailyBalancesController } from './daily-balances.controller';
import { PrismaService } from '../../config/database.config';

@Module({
  controllers: [DailyBalancesController],
  providers: [DailyBalancesService, PrismaService],
})
export class DailyBalancesModule {}
