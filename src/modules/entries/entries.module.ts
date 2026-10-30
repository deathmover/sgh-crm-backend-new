import { Module, forwardRef } from '@nestjs/common';
import { EntriesService } from './entries.service';
import { EntriesController } from './entries.controller';
import { PrismaService } from '../../config/database.config';
import { MachinesModule } from '../machines/machines.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [MachinesModule, ProductsModule, forwardRef(() => MembershipsModule)],
  controllers: [EntriesController],
  providers: [EntriesService, PrismaService],
  exports: [EntriesService],
})
export class EntriesModule {}
