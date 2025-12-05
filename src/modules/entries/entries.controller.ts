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
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EntriesService } from './entries.service';
import { CreateEntryDto } from './dto/create-entry.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';
import { EndEntryDto } from './dto/end-entry.dto';
import { EntryQueryDto } from './dto/entry-query.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@ApiTags('Entries / Daily Sheet')
@ApiBearerAuth()
@Controller('entries')
export class EntriesController {
  constructor(private readonly entriesService: EntriesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new entry (start timer)' })
  create(@Body() createEntryDto: CreateEntryDto) {
    return this.entriesService.create(createEntryDto);
  }

  @Get('export/csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="daily-sheet.csv"')
  @ApiOperation({ summary: 'Export entries as CSV' })
  async exportCsv(@Query() query: EntryQueryDto, @Res() res: Response) {
    const csv = await this.entriesService.exportToCsv(query);
    res.send(csv);
  }

  @Get()
  @ApiOperation({ summary: 'Get all entries with filters and pagination' })
  findAll(@Query() query: EntryQueryDto) {
    return this.entriesService.findAll(query);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get all active entries (not ended yet)' })
  getActiveEntries() {
    return this.entriesService.getActiveEntries();
  }

  @Get('daily-sheet')
  @ApiOperation({ summary: 'Get daily sheet for a specific date' })
  getDailySheet(@Query('date') date: string) {
    return this.entriesService.getDailySheet(date);
  }

  @Get('deleted')
  @ApiOperation({ summary: 'Get all deleted entries' })
  getDeleted(@Query() query: EntryQueryDto) {
    return this.entriesService.getDeleted(query);
  }

  @Patch(':id/end')
  @ApiOperation({ summary: 'End an entry (stop timer and calculate cost)' })
  endEntry(@Param('id') id: string, @Body() endEntryDto: EndEntryDto) {
    return this.entriesService.endEntry(id, endEntryDto);
  }

  @Patch(':id/payment')
  @ApiOperation({ summary: 'Update payment for an entry (split payment support)' })
  updatePayment(
    @Param('id') id: string,
    @Body() updatePaymentDto: UpdatePaymentDto,
  ) {
    return this.entriesService.updatePayment(id, updatePaymentDto);
  }

  @Post('auto-end-expired')
  @ApiOperation({ summary: 'Manually trigger auto-end for expired sessions' })
  autoEndExpired() {
    return this.entriesService.autoEndExpiredSessions();
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore a soft-deleted entry' })
  restore(@Param('id') id: string) {
    return this.entriesService.restore(id);
  }

  @Delete(':id/soft')
  @ApiOperation({ summary: 'Soft delete an entry' })
  softDelete(@Param('id') id: string) {
    return this.entriesService.softDelete(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get entry details by ID' })
  findOne(@Param('id') id: string) {
    return this.entriesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an entry' })
  update(@Param('id') id: string, @Body() updateEntryDto: UpdateEntryDto) {
    return this.entriesService.update(id, updateEntryDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an entry' })
  remove(@Param('id') id: string) {
    return this.entriesService.delete(id);
  }
}
