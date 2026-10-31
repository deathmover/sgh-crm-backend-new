import { Body, Controller, Get, Injectable, Module, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { PrismaService } from '../../config/database.config';

// Café-level preferences stored in system_settings. Only these keys are exposed.
const KEYS = {
  cafeName: 'cafe_name',
  ownerWhatsapp: 'owner_whatsapp',
  monthlyTarget: 'monthly_target',
} as const;

// Used until the owner number is saved from Settings (an explicit blank is respected)
const DEFAULT_OWNER_WHATSAPP = '917507004457';

/** monthlyTarget is a revenue goal in rupees; 0 means not set */
export type CafeSettings = { cafeName: string; ownerWhatsapp: string; monthlyTarget: number };

export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 'Shaukeens Gaming Hub' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  cafeName?: string;

  @ApiPropertyOptional({ example: '919876543210', description: 'With country code, digits only' })
  @IsOptional()
  @Matches(/^\d{0,15}$/, { message: 'WhatsApp number must be digits only, with country code (e.g. 919876543210)' })
  ownerWhatsapp?: string;

  @ApiPropertyOptional({ example: 300000, description: 'Monthly revenue goal in rupees (0 clears it)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  monthlyTarget?: number;
}

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async get(): Promise<CafeSettings> {
    const rows = await this.prisma.systemSetting.findMany({ where: { key: { in: Object.values(KEYS) } } });
    const row = (key: string) => rows.find((r) => r.key === key);
    return {
      cafeName: row(KEYS.cafeName)?.value || 'SGH Gaming Hub',
      ownerWhatsapp: row(KEYS.ownerWhatsapp)?.value ?? DEFAULT_OWNER_WHATSAPP,
      monthlyTarget: Number(row(KEYS.monthlyTarget)?.value) || 0,
    };
  }

  async update(dto: UpdateSettingsDto): Promise<CafeSettings> {
    for (const [field, key] of Object.entries(KEYS)) {
      const raw = dto[field as keyof UpdateSettingsDto];
      if (raw === undefined) continue;
      let value = String(raw);
      // A bare 10-digit number is Indian; wa.me needs the country code
      if (field === 'ownerWhatsapp' && /^\d{10}$/.test(value)) value = `91${value}`;
      await this.prisma.systemSetting.upsert({
        where: { key },
        create: { key, value: value.trim(), category: 'general' },
        update: { value: value.trim() },
      });
    }
    return this.get();
  }
}

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Café settings (name, owner WhatsApp, monthly target)' })
  get() {
    return this.settingsService.get();
  }

  @Patch()
  @ApiOperation({ summary: 'Update café settings' })
  update(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.update(dto);
  }
}

@Module({
  controllers: [SettingsController],
  providers: [SettingsService, PrismaService],
  exports: [SettingsService],
})
export class SettingsModule {}
