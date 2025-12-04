import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';

@ApiTags('Expenses')
@ApiBearerAuth()
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new expense' })
  create(@Body() createExpenseDto: CreateExpenseDto) {
    return this.expensesService.create(createExpenseDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all expenses with filters' })
  findAll(@Query() query: ExpenseQueryDto) {
    return this.expensesService.findAll(query);
  }

  @Get('category-breakdown')
  @ApiOperation({ summary: 'Get expense breakdown by category' })
  getCategoryBreakdown(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.expensesService.getCategoryBreakdown(startDate, endDate);
  }

  @Get('monthly-trend')
  @ApiOperation({ summary: 'Get monthly expense trend' })
  getMonthlyTrend(@Query('months') months?: string) {
    const monthCount = months ? parseInt(months, 10) : 6;
    return this.expensesService.getMonthlyTrend(monthCount);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get expense by ID' })
  findOne(@Param('id') id: string) {
    return this.expensesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an expense' })
  update(@Param('id') id: string, @Body() updateExpenseDto: UpdateExpenseDto) {
    return this.expensesService.update(id, updateExpenseDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an expense' })
  remove(@Param('id') id: string) {
    return this.expensesService.remove(id);
  }
}
