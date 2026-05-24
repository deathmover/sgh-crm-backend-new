import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PartnerLoansService } from './partner-loans.service';
import { CreatePartnerLoanDto } from './dto/create-partner-loan.dto';
import { UpdatePartnerLoanDto } from './dto/update-partner-loan.dto';

@ApiTags('Partner Loans')
@ApiBearerAuth()
@Controller('partner-loans')
export class PartnerLoansController {
  constructor(private readonly service: PartnerLoansService) {}

  @Post()
  @ApiOperation({ summary: 'Record a partner loan or repayment' })
  create(@Body() dto: CreatePartnerLoanDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all loan transactions, optionally filtered by partner' })
  findAll(@Query('partnerName') partnerName?: string) {
    return this.service.findAll(partnerName);
  }

  @Get('balances')
  @ApiOperation({ summary: 'Get outstanding loan balance per partner' })
  getBalances() {
    return this.service.getBalances();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePartnerLoanDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
