import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/database.config';
import { CreatePartnerLoanDto } from './dto/create-partner-loan.dto';
import { UpdatePartnerLoanDto } from './dto/update-partner-loan.dto';

const PARTNERS = [
  'Sudarshan Nanaware',
  'Ravi Parmar',
  'Omkar Nikam',
  'Sudarshan Shinde',
  'Vaibhav Lohkare',
];

@Injectable()
export class PartnerLoansService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreatePartnerLoanDto) {
    return this.prisma.partnerLoan.create({
      data: { ...dto, date: new Date(dto.date) },
    });
  }

  async findAll(partnerName?: string) {
    const where: any = partnerName ? { partnerName } : {};
    return this.prisma.partnerLoan.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  async getBalances() {
    const loans = await this.prisma.partnerLoan.findMany();
    return PARTNERS.map((name) => {
      const partnerLoans = loans.filter((l) => l.partnerName === name);
      const borrowed = partnerLoans
        .filter((l) => l.type === 'borrow')
        .reduce((s, l) => s + l.amount, 0);
      const repaid = partnerLoans
        .filter((l) => l.type === 'repay')
        .reduce((s, l) => s + l.amount, 0);
      return { partnerName: name, borrowed, repaid, outstanding: borrowed - repaid };
    });
  }

  async update(id: string, dto: UpdatePartnerLoanDto) {
    const existing = await this.prisma.partnerLoan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Partner loan ${id} not found`);
    const data: any = { ...dto };
    if (dto.date) data.date = new Date(dto.date);
    return this.prisma.partnerLoan.update({ where: { id }, data });
  }

  async remove(id: string) {
    const existing = await this.prisma.partnerLoan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Partner loan ${id} not found`);
    return this.prisma.partnerLoan.delete({ where: { id } });
  }
}
