import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto, RestockDto, UpdateProductDto } from './dto/product.dto';

@ApiTags('Snacks & Drinks')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Menu items with stock, low-stock flag and units sold today' })
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.productsService.findAll(includeInactive === 'true');
  }

  @Post()
  @ApiOperation({ summary: 'Add a menu item' })
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a menu item (name, price, cost, low-stock level)' })
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a menu item (hidden instead if it has been sold)' })
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Post(':id/restock')
  @ApiOperation({ summary: 'Add stock (or correct it with a negative quantity)' })
  restock(@Param('id') id: string, @Body() dto: RestockDto) {
    return this.productsService.restock(id, dto);
  }

  @Get(':id/movements')
  @ApiOperation({ summary: 'Stock history' })
  movements(@Param('id') id: string) {
    return this.productsService.movements(id);
  }
}
