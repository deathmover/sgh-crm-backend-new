import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { applyPendingRestore, databasePath } from './modules/backups/backup-files';

async function bootstrap() {
  // A restore chosen in Settings swaps the file before anything opens it
  // (the desktop app does this itself before migrating, so this is for other setups)
  applyPendingRestore(databasePath(), undefined, (msg) => new Logger('Backups').warn(msg));

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // CORS Configuration
  app.enableCors({
    origin: true, // In production, specify exact origins
    credentials: true,
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // API Prefix
  app.setGlobalPrefix('api/v1');

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('SGH Gaming Hub CRM API')
    .setDescription(
      'Backend API for Shaukeens Gaming Hub - Customer Relationship Management System',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Authentication', 'User authentication and authorization')
    .addTag('Customers', 'Customer management endpoints')
    .addTag('Machines', 'Gaming machine management')
    .addTag(
      'Entries / Daily Sheet',
      'Session entries and daily sheet management',
    )
    .addTag('Analytics', 'Analytics and reporting endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = configService.get<number>('PORT') || 3000;
  // Electron sets HOST=127.0.0.1 so other PCs on the café LAN can't reach the API
  const host = configService.get<string>('HOST');
  await (host ? app.listen(port, host) : app.listen(port));

  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
  logger.log(`🔐 Default Admin: ${configService.get('SUPER_ADMIN_USERNAME')}`);
}

void bootstrap();
