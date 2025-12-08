import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Parser } from 'json2csv';
import * as XLSX from 'xlsx';
import { Readable } from 'stream';
import { PrismaService } from '../../config/database.config';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async create(createCustomerDto: CreateCustomerDto) {
    const { phone } = createCustomerDto;

    // Check for duplicate phone
    if (phone) {
      const existingByPhone = await this.prisma.customer.findUnique({
        where: { phone },
      });
      if (existingByPhone) {
        throw new ConflictException('Customer with this phone already exists');
      }
    }

    return this.prisma.customer.create({
      data: createCustomerDto,
    });
  }

  async findAll(query: CustomerQueryDto) {
    const { search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          pendingCredit: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    // Calculate total pending credit (Manual + Entry-based)
    const customersWithCredit = await Promise.all(
      customers.map(async (customer) => {
        const entryStats = await this.prisma.entry.aggregate({
          where: {
            customerId: customer.id,
            creditAmount: { gt: 0 },
            isDeleted: false,
          },
          _sum: { creditAmount: true },
        });

        const entryCredit = entryStats._sum.creditAmount || 0;
        const totalCredit = (customer.pendingCredit || 0) + entryCredit;

        return {
          ...customer,
          pendingCredit: totalCredit,
        };
      }),
    );

    return {
      data: customersWithCredit,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        entries: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            machine: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
        _count: {
          select: { entries: true },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Calculate total spent
    const totalSpent = await this.prisma.entry.aggregate({
      where: { customerId: id },
      _sum: { finalAmount: true },
    });

    return {
      ...customer,
      totalSpent: totalSpent._sum.finalAmount || 0,
    };
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto) {
    await this.findOne(id);

    const { phone } = updateCustomerDto;

    // Check for duplicate phone if updating phone
    if (phone) {
      const existingByPhone = await this.prisma.customer.findUnique({
        where: { phone },
      });
      if (existingByPhone && existingByPhone.id !== id) {
        throw new ConflictException('Customer with this phone already exists');
      }
    }

    return this.prisma.customer.update({
      where: { id },
      data: updateCustomerDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.customer.delete({
      where: { id },
    });
  }

  async getCustomerStats(id: string) {
    // Get customer with pending credit
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      select: { pendingCredit: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const stats = await this.prisma.entry.aggregate({
      where: { customerId: id, isDeleted: false },
      _sum: {
        finalAmount: true,
        duration: true,
        creditAmount: true,
      },
      _count: true,
    });

    const lastEntry = await this.prisma.entry.findFirst({
      where: { customerId: id, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const totalCredit = (customer.pendingCredit || 0) + (stats._sum.creditAmount || 0);

    return {
      totalVisits: stats._count,
      totalSpent: stats._sum.finalAmount || 0,
      pendingCredit: totalCredit,
      lastVisit: lastEntry?.createdAt?.toISOString(),
    };
  }

  async payCredit(
    customerId: string,
    paymentDto: { cashAmount: number; onlineAmount: number },
  ) {
    // Get customer with current pending credit
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, pendingCredit: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const { cashAmount, onlineAmount } = paymentDto;
    const totalPayment = cashAmount + onlineAmount;

    if (totalPayment <= 0) {
      throw new ConflictException('Payment amount must be greater than 0');
    }

    // Get all unpaid/partial entries for this customer
    const unpaidEntries = await this.prisma.entry.findMany({
      where: {
        customerId,
        endTime: { not: null },
        creditAmount: { gt: 0 },
        isDeleted: false,
      },
      orderBy: { endTime: 'asc' }, // Pay off oldest debts first
    });

    // Check if customer has any pending credit (either from entries or customer balance)
    if (unpaidEntries.length === 0 && (customer.pendingCredit || 0) <= 0) {
      throw new ConflictException('Customer has no pending credit');
    }

    let remainingPayment = totalPayment;
    const updatedEntries: any[] = [];

    // First, pay off entry-based credits (from gaming sessions)
    for (const entry of unpaidEntries) {
      if (remainingPayment <= 0) break;

      const entryCredit = entry.creditAmount || 0;
      const paymentForEntry = Math.min(remainingPayment, entryCredit);

      // Calculate how to split the payment (proportionally based on input)
      const cashForEntry =
        cashAmount > 0 ? (paymentForEntry * cashAmount) / totalPayment : 0;
      const onlineForEntry =
        onlineAmount > 0 ? (paymentForEntry * onlineAmount) / totalPayment : 0;

      // Update entry with payment
      const updatedEntry = await this.prisma.entry.update({
        where: { id: entry.id },
        data: {
          cashAmount: (entry.cashAmount || 0) + cashForEntry,
          onlineAmount: (entry.onlineAmount || 0) + onlineForEntry,
          creditAmount: entryCredit - paymentForEntry,
          paymentStatus:
            entryCredit - paymentForEntry === 0
              ? 'paid'
              : (entry.cashAmount || 0) +
                    (entry.onlineAmount || 0) +
                    cashForEntry +
                    onlineForEntry >
                  0
                ? 'partial'
                : 'unpaid',
        },
      });

      updatedEntries.push(updatedEntry);
      remainingPayment -= paymentForEntry;
    }

    // Second, if there's remaining payment, apply it to customer's pending credit
    let updatedCustomerCredit = customer.pendingCredit || 0;
    if (remainingPayment > 0 && updatedCustomerCredit > 0) {
      const paymentForCustomerCredit = Math.min(
        remainingPayment,
        updatedCustomerCredit,
      );
      updatedCustomerCredit -= paymentForCustomerCredit;
      remainingPayment -= paymentForCustomerCredit;

      // Update customer's pending credit
      await this.prisma.customer.update({
        where: { id: customerId },
        data: { pendingCredit: updatedCustomerCredit },
      });
    }

    return {
      success: true,
      totalPayment,
      entriesUpdated: updatedEntries.length,
      remainingCredit: remainingPayment,
      customerCreditPaid: (customer.pendingCredit || 0) - updatedCustomerCredit,
      newCustomerCredit: updatedCustomerCredit,
    };
  }

  async exportToCsv(query: CustomerQueryDto): Promise<string> {
    const { search } = query;

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    // Get all customers (no pagination for export)
    const customers = await this.prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { entries: true },
        },
      },
    });

    // Calculate total spent for each customer
    const customersWithStats = await Promise.all(
      customers.map(async (customer) => {
        const stats = await this.prisma.entry.aggregate({
          where: { customerId: customer.id, isDeleted: false },
          _sum: { finalAmount: true },
        });

        return {
          Name: customer.name,
          Phone: customer.phone || '',
          Email: customer.email || '',
          'Pending Credit': customer.pendingCredit,
          'Total Visits': customer._count.entries,
          'Total Spent': stats._sum.finalAmount || 0,
          Notes: customer.notes || '',
          'Created At': customer.createdAt.toISOString(),
        };
      }),
    );

    // Convert to CSV
    const parser = new Parser({
      fields: [
        'Name',
        'Phone',
        'Email',
        'Pending Credit',
        'Total Visits',
        'Total Spent',
        'Notes',
        'Created At',
      ],
    });

    return parser.parse(customersWithStats);
  }

  async bulkImport(customers: Array<{
    name: string;
    phone: string;
    email?: string;
    creditAmount?: number;
    notes?: string;
  }>) {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ name: string; phone: string; error: string }>,
    };

    for (const customerData of customers) {
      try {
        // Check if customer already exists by phone
        const existing = await this.prisma.customer.findFirst({
          where: { phone: customerData.phone },
        });

        if (existing) {
          results.errors.push({
            name: customerData.name,
            phone: customerData.phone,
            error: 'Customer with this phone already exists',
          });
          results.failed++;
          continue;
        }

        // Create customer with pending credit if specified
        await this.prisma.customer.create({
          data: {
            name: customerData.name,
            phone: customerData.phone,
            email: customerData.email,
            notes: customerData.notes,
            pendingCredit:
              customerData.creditAmount && customerData.creditAmount > 0
                ? customerData.creditAmount
                : 0,
          },
        });

        results.success++;
      } catch (error) {
        results.errors.push({
          name: customerData.name,
          phone: customerData.phone,
          error: error.message || 'Unknown error',
        });
        results.failed++;
      }
    }

    return results;
  }

  async importFromFile(file: Express.Multer.File) {
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
    let customers: any[] = [];

    try {
      if (fileExtension === 'csv') {
        customers = await this.parseCsvFile(file.buffer);
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        customers = this.parseExcelFile(file.buffer);
      } else {
        throw new BadRequestException('Unsupported file format');
      }

      // Validate and normalize customer data, collecting errors instead of throwing
      const normalizedCustomers: any[] = [];
      const validationErrors: Array<{ name: string; phone: string; error: string }> = [];

      customers.forEach((row, index) => {
        const name = row.name || row.Name || row.NAME;
        const phone = row.phone || row.Phone || row.PHONE;
        const email = row.email || row.Email || row.EMAIL || undefined;
        const creditAmount = row.creditAmount || row['Credit Amount'] || row.CREDIT_AMOUNT || 0;
        const notes = row.notes || row.Notes || row.NOTES || undefined;

        // Skip completely empty rows
        if (!name && !phone && !email && !creditAmount && !notes) {
          return; // Skip this row
        }

        // Validate required fields
        if (!name || !phone) {
          validationErrors.push({
            name: name || 'Unknown',
            phone: phone || 'Missing',
            error: `Row ${index + 2}: Name and Phone are required fields`,
          });
          return; // Skip this row
        }

        // Validate phone number (basic validation)
        const phoneStr = String(phone).trim();
        if (phoneStr.length < 10) {
          validationErrors.push({
            name: String(name).trim(),
            phone: phoneStr,
            error: `Row ${index + 2}: Invalid phone number (minimum 10 digits required)`,
          });
          return; // Skip this row
        }

        // Add to normalized customers if valid
        normalizedCustomers.push({
          name: String(name).trim(),
          phone: phoneStr,
          email: email ? String(email).trim() : undefined,
          creditAmount: creditAmount ? Number(creditAmount) : 0,
          notes: notes ? String(notes).trim() : undefined,
        });
      });

      // If no valid customers found, return error result
      if (normalizedCustomers.length === 0 && validationErrors.length > 0) {
        return {
          success: 0,
          failed: validationErrors.length,
          errors: validationErrors,
        };
      }

      // Import valid customers using existing bulkImport method
      const importResult = await this.bulkImport(normalizedCustomers);

      // Combine validation errors with import errors
      return {
        success: importResult.success,
        failed: importResult.failed + validationErrors.length,
        errors: [...validationErrors, ...importResult.errors],
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error parsing file: ${error.message}`,
      );
    }
  }

  private async parseCsvFile(buffer: Buffer): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const stream = Readable.from(buffer);
      const csvParser = require('csv-parser');

      stream
        .pipe(csvParser())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (error) => reject(error));
    });
  }

  private parseExcelFile(buffer: Buffer): any[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      throw new BadRequestException('Excel file is empty');
    }

    return data;
  }

  generateSampleCsv(): string {
    const sampleData = [
      {
        name: 'John Doe',
        phone: '9876543210',
        email: 'john@example.com',
        creditAmount: 0,
        notes: 'VIP Customer',
      },
      {
        name: 'Jane Smith',
        phone: '9123456789',
        email: 'jane@example.com',
        creditAmount: 500,
        notes: 'Regular customer with initial credit',
      },
      {
        name: 'Bob Wilson',
        phone: '9988776655',
        email: '',
        creditAmount: 0,
        notes: '',
      },
    ];

    const parser = new Parser({
      fields: [
        { label: 'name', value: 'name' },
        { label: 'phone', value: 'phone' },
        { label: 'email', value: 'email' },
        { label: 'creditAmount', value: 'creditAmount' },
        { label: 'notes', value: 'notes' },
      ],
    });

    return parser.parse(sampleData);
  }

  async generateSampleExcel(): Promise<Buffer> {
    const sampleData = [
      {
        name: 'John Doe',
        phone: '9876543210',
        email: 'john@example.com',
        creditAmount: 0,
        notes: 'VIP Customer',
      },
      {
        name: 'Jane Smith',
        phone: '9123456789',
        email: 'jane@example.com',
        creditAmount: 500,
        notes: 'Regular customer with initial credit',
      },
      {
        name: 'Bob Wilson',
        phone: '9988776655',
        email: '',
        creditAmount: 0,
        notes: '',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');

    // Generate buffer
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }
}
