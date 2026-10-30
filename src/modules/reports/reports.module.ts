import { Controller, Get, Module, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../config/database.config';
import { SettingsModule } from '../settings/settings.module';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('daily-summary')
  @ApiOperation({ summary: 'End-of-day summary (for WhatsApp / PDF)' })
  @ApiQuery({ name: 'date', required: false, example: '2026-10-29' })
  dailySummary(@Query('date') date?: string) {
    return this.reportsService.dailySummary(date);
  }

  @Get('profit-loss')
  @ApiOperation({ summary: 'Monthly profit & loss with daily breakdown (for Excel export)' })
  @ApiQuery({ name: 'year', example: 2026 })
  @ApiQuery({ name: 'month', example: 10, description: '1–12' })
  profitLoss(@Query('year') year: string, @Query('month') month: string) {
    return this.reportsService.profitLoss(Number(year), Number(month));
  }
}

@Module({
  imports: [SettingsModule],
  controllers: [ReportsController],
  providers: [ReportsService, PrismaService],
})
export class ReportsModule {}
