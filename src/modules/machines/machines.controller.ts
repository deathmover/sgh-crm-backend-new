import { Controller, Get, Param, Patch, Body, Post, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MachinesService } from './machines.service';
import type { ControllerRates } from './pricing';

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
      controllerRates?: ControllerRates;
    },
  ) {
    return this.machinesService.create(createData);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a machine (archived instead if it has history)' })
  remove(@Param('id') id: string) {
    return this.machinesService.remove(id);
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
      halfHourlyRate?: number | null;
      packageRates?: Record<string, number>;
      controllerRates?: ControllerRates | null;
    },
  ) {
    return this.machinesService.updateRates(id, updateData);
  }
}
