import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PartnerProfitsService } from './partner-profits.service';
import { CreatePartnerProfitDto } from './dto/create-partner-profit.dto';
import { UpdatePartnerProfitDto } from './dto/update-partner-profit.dto';

@ApiTags('Partner Profits')
@ApiBearerAuth()
@Controller('partner-profits')
export class PartnerProfitsController {
  constructor(private readonly service: PartnerProfitsService) {}

  @Post()
  @ApiOperation({ summary: 'Create or update partner profit for a month' })
  upsert(@Body() dto: CreatePartnerProfitDto) {
    return this.service.upsert(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all partner profits, optionally filtered by year' })
  findAll(@Query('year') year?: string) {
    return this.service.findAll(year ? parseInt(year) : undefined);
  }

  @Get('month')
  @ApiOperation({ summary: 'Get partner profits for a specific month/year' })
  findByMonth(@Query('month') month: string, @Query('year') year: string) {
    return this.service.findByMonth(parseInt(month), parseInt(year));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePartnerProfitDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
