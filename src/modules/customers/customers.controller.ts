import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Res,
  Header,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { BulkImportCustomersDto } from './dto/bulk-import.dto';

@ApiTags('Customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new customer' })
  create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(createCustomerDto);
  }

  @Post('bulk-import')
  @ApiOperation({ summary: 'Bulk import customers from Excel/CSV data' })
  bulkImport(@Body() bulkImportDto: BulkImportCustomersDto) {
    return this.customersService.bulkImport(bulkImportDto.customers);
  }

  @Post('import/file')
  @ApiOperation({ summary: 'Import customers from CSV or Excel file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV or Excel file (.csv, .xlsx, .xls)',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async importFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const allowedMimeTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!allowedMimeTypes.includes(file.mimetype) &&
        !file.originalname.match(/\.(csv|xlsx|xls)$/)) {
      throw new BadRequestException(
        'Invalid file type. Please upload a CSV or Excel file.',
      );
    }

    return this.customersService.importFromFile(file);
  }

  @Get('import/sample-csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="customers_import_sample.csv"')
  @ApiOperation({ summary: 'Download sample CSV template for customer import' })
  async downloadSampleCsv(@Res() res: Response) {
    const csv = this.customersService.generateSampleCsv();
    res.send(csv);
  }

  @Get('import/sample-excel')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header('Content-Disposition', 'attachment; filename="customers_import_sample.xlsx"')
  @ApiOperation({ summary: 'Download sample Excel template for customer import' })
  async downloadSampleExcel(@Res() res: Response) {
    const buffer = await this.customersService.generateSampleExcel();
    res.send(buffer);
  }

  @Get('export/csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="customers.csv"')
  @ApiOperation({ summary: 'Export all customers as CSV' })
  async exportCsv(@Query() query: CustomerQueryDto, @Res() res: Response) {
    const csv = await this.customersService.exportToCsv(query);
    res.send(csv);
  }

  @Get()
  @ApiOperation({ summary: 'Get all customers with search and pagination' })
  findAll(@Query() query: CustomerQueryDto) {
    return this.customersService.findAll(query);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get customer statistics' })
  getStats(@Param('id') id: string) {
    return this.customersService.getCustomerStats(id);
  }

  @Post(':id/pay-credit')
  @ApiOperation({ summary: 'Pay off customer credit' })
  payCredit(
    @Param('id') id: string,
    @Body() paymentDto: { cashAmount: number; onlineAmount: number },
  ) {
    return this.customersService.payCredit(id, paymentDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer details by ID' })
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update customer details' })
  update(
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, updateCustomerDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a customer' })
  remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }
}
