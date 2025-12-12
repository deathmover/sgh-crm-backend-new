import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './config/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { MachinesModule } from './modules/machines/machines.module';
import { EntriesModule } from './modules/entries/entries.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    CustomersModule,
    MachinesModule,
    EntriesModule,
    AnalyticsModule,
    ExpensesModule,
    MembershipsModule,
    BookingsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
