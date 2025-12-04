import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { DateRangeQueryDto } from './dto/date-range-query.dto';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiQuery({ name: 'date', required: false, example: '2025-09-30' })
  @ApiQuery({ name: 'startDate', required: false, example: '2025-09-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2025-09-30' })
  getDashboardStats(
    @Query('date') date?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getDashboardStats(date, startDate, endDate);
  }

  @Get('machine-usage')
  @ApiOperation({ summary: 'Get machine usage statistics' })
  getMachineUsage(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getMachineUsageStats(
      query.startDate,
      query.endDate,
    );
  }

  @Get('weekly-revenue')
  @ApiOperation({ summary: 'Get weekly revenue trend (last 7 days)' })
  getWeeklyRevenue() {
    return this.analyticsService.getWeeklyRevenueTrend();
  }

  @Get('payment-breakdown')
  @ApiOperation({ summary: 'Get payment type breakdown' })
  getPaymentBreakdown(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getPaymentTypeBreakdown(
      query.startDate,
      query.endDate,
    );
  }

  @Get('top-customers')
  @ApiOperation({ summary: 'Get top customers by spending' })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'startDate', required: false, example: '2025-09-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2025-09-30' })
  getTopCustomers(
    @Query('limit') limit?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.analyticsService.getTopCustomers(
      parsedLimit,
      startDate,
      endDate,
    );
  }

  @Get('revenue-report')
  @ApiOperation({ summary: 'Get comprehensive revenue report' })
  getRevenueReport(@Query() query: DateRangeQueryDto) {
    if (!query.startDate || !query.endDate) {
      // Default to current month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      query.startDate = startOfMonth.toISOString().split('T')[0];
      query.endDate = endOfMonth.toISOString().split('T')[0];
    }
    return this.analyticsService.getRevenueReport(
      query.startDate,
      query.endDate,
    );
  }

  @Get('peak-hours')
  @ApiOperation({ summary: 'Get peak hours analysis' })
  @ApiQuery({ name: 'date', required: false, example: '2025-09-30' })
  @ApiQuery({ name: 'startDate', required: false, example: '2025-09-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2025-09-30' })
  getPeakHours(
    @Query('date') date?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getPeakHours(date, startDate, endDate);
  }

  @Get('machine-utilization')
  @ApiOperation({ summary: 'Get machine utilization rates' })
  @ApiQuery({ name: 'date', required: false, example: '2025-09-30' })
  @ApiQuery({ name: 'startDate', required: false, example: '2025-09-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2025-09-30' })
  getMachineUtilization(
    @Query('date') date?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getMachineUtilization(date, startDate, endDate);
  }

  @Get('financial-analysis')
  @ApiOperation({ summary: 'Get comprehensive financial analysis (cash flow, profit/loss)' })
  @ApiQuery({ name: 'startDate', required: false, example: '2025-01-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2025-01-31' })
  getFinancialAnalysis(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getFinancialAnalysis(startDate, endDate);
  }
}
