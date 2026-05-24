import { Module } from '@nestjs/common';
import { PartnerProfitsService } from './partner-profits.service';
import { PartnerProfitsController } from './partner-profits.controller';
import { PrismaService } from '../../config/database.config';

@Module({
  controllers: [PartnerProfitsController],
  providers: [PartnerProfitsService, PrismaService],
})
export class PartnerProfitsModule {}
