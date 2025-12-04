import { Controller, Get, Param, Patch, Body, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MachinesService } from './machines.service';

@ApiTags('Machines')
@ApiBearerAuth()
@Controller('machines')
export class MachinesController {
  constructor(private readonly machinesService: MachinesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all machines' })
  findAll() {
    return this.machinesService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new machine' })
  create(
    @Body()
    createData: {
      name: string;
      type: string;
      units: number;
      hourlyRate: number;
      halfHourlyRate?: number;
    },
  ) {
    return this.machinesService.create(createData);
  }

  @Get('available')
  @ApiOperation({ summary: 'Get available machines with availability status' })
  getAvailableMachines() {
    return this.machinesService.getAvailableMachines();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get machine details by ID' })
  findOne(@Param('id') id: string) {
    return this.machinesService.findOne(id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get machine statistics' })
  getStats(@Param('id') id: string) {
    return this.machinesService.getMachineStats(id);
  }

  @Patch(':id/rates')
  @ApiOperation({ summary: 'Update machine rates' })
  updateRates(
    @Param('id') id: string,
    @Body()
    updateData: {
      hourlyRate?: number;
      halfHourlyRate?: number;
      packageRates?: Record<string, number>;
    },
  ) {
    return this.machinesService.updateRates(id, updateData);
  }
}
