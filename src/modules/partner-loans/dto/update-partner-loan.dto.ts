import { PartialType } from '@nestjs/swagger';
import { CreatePartnerLoanDto } from './create-partner-loan.dto';

export class UpdatePartnerLoanDto extends PartialType(CreatePartnerLoanDto) {}
