import { Controller, Get, Module, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../config/database.config';
import { SettingsModule } from '../settings/settings.module';
import { ReportsService } from './reports.service';
import { InsightsService } from './insights.service';

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

  @Get('snacks')
  @ApiOperation({ summary: 'Snacks & drinks analytics for a date range (defaults to this month)' })
  @ApiQuery({ name: 'startDate', required: false, example: '2026-10-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2026-10-31' })
  snacks(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.reportsService.snacks(startDate, endDate);
  }
}

const START_DATE = { name: 'startDate', required: false, example: '2026-10-01' };
const END_DATE = { name: 'endDate', required: false, example: '2026-10-31' };

@ApiTags('Insights')
@ApiBearerAuth()
@Controller('insights')
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get('customers')
  @ApiOperation({ summary: 'Regulars, lapsed customers, spend per visit, first-timer return rate' })
  @ApiQuery(START_DATE)
  @ApiQuery(END_DATE)
  customers(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.insights.customers(startDate, endDate);
  }

  @Get('occupancy')
  @ApiOperation({ summary: 'Minutes in use per machine by weekday and hour' })
  @ApiQuery(START_DATE)
  @ApiQuery(END_DATE)
  occupancy(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.insights.occupancy(startDate, endDate);
  }

  @Get('pricing')
  @ApiOperation({ summary: 'Hourly vs package vs membership sessions, packages sold, discounts by login' })
  @ApiQuery(START_DATE)
  @ApiQuery(END_DATE)
  pricing(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.insights.pricing(startDate, endDate);
  }

  @Get('credit')
  @ApiOperation({ summary: 'Outstanding credit by age, and credit given vs collected per month' })
  credit() {
    return this.insights.credit();
  }

  @Get('memberships')
  @ApiOperation({ summary: 'Membership plans: hours bought vs played and value vs walk-in rates' })
  @ApiQuery(START_DATE)
  @ApiQuery(END_DATE)
  memberships(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.insights.memberships(startDate, endDate);
  }

  @Get('target')
  @ApiOperation({ summary: 'This month vs the monthly revenue target, with a forecast' })
  target() {
    return this.insights.target();
  }
}

@Module({
  imports: [SettingsModule],
  controllers: [ReportsController, InsightsController],
  providers: [ReportsService, InsightsService, PrismaService],
})
export class ReportsModule {}
