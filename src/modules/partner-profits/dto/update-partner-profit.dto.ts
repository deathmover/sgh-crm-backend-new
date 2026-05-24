import { PartialType } from '@nestjs/swagger';
import { CreatePartnerProfitDto } from './create-partner-profit.dto';

export class UpdatePartnerProfitDto extends PartialType(CreatePartnerProfitDto) {}
