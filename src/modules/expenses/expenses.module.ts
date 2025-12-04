import { Module } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { PrismaService } from '../../config/database.config';

@Module({
  controllers: [ExpensesController],
  providers: [ExpensesService, PrismaService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
