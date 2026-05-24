import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DailyBalancesService } from './daily-balances.service';
import { CreateDailyBalanceDto } from './dto/create-daily-balance.dto';
import { UpdateDailyBalanceDto } from './dto/update-daily-balance.dto';

@ApiTags('Daily Balances')
@ApiBearerAuth()
@Controller('daily-balances')
export class DailyBalancesController {
  constructor(private readonly service: DailyBalancesService) {}

  @Post()
  @ApiOperation({ summary: 'Create daily balance record' })
  create(@Body() dto: CreateDailyBalanceDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get daily balances (filter by month/year)' })
  findAll(@Query('month') month?: string, @Query('year') year?: string) {
    return this.service.findAll(
      month ? parseInt(month) : undefined,
      year ? parseInt(year) : undefined,
    );
  }

  @Get('last-closing')
  @ApiOperation({ summary: 'Get last day with closing balances filled' })
  getLastClosing() {
    return this.service.getLastClosing();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDailyBalanceDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
