import { Module } from '@nestjs/common';
import { PartnerLoansService } from './partner-loans.service';
import { PartnerLoansController } from './partner-loans.controller';
import { PrismaService } from '../../config/database.config';

@Module({
  controllers: [PartnerLoansController],
  providers: [PartnerLoansService, PrismaService],
})
export class PartnerLoansModule {}
