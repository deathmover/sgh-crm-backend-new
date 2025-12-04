import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/database.config';
import { CreateMembershipPlanDto } from './dto/create-membership-plan.dto';
import { UpdateMembershipPlanDto } from './dto/update-membership-plan.dto';
import { PurchaseMembershipDto } from './dto/purchase-membership.dto';

@Injectable()
export class MembershipsService {
  constructor(private prisma: PrismaService) {}

  // Check if membership system is enabled
  async isMembershipEnabled(): Promise<boolean> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'membership_enabled' },
    });
    return setting?.value === 'true';
  }

  // ========== MEMBERSHIP PLANS ==========

  async createPlan(createDto: CreateMembershipPlanDto) {
    const pricePerHour = createDto.price / createDto.hours;

    return this.prisma.membershipPlan.create({
      data: {
        ...createDto,
        pricePerHour,
      },
    });
  }

  async findAllPlans(includeInactive = false) {
    const where = includeInactive ? {} : { isActive: true };

    return this.prisma.membershipPlan.findMany({
      where,
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: {
          select: { customerMemberships: true },
        },
      },
    });
  }

  async findPlanById(id: string) {
    const plan = await this.prisma.membershipPlan.findUnique({
      where: { id },
      include: {
        _count: {
          select: { customerMemberships: true },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException(`Membership plan with ID ${id} not found`);
    }

    return plan;
  }

  async updatePlan(id: string, updateDto: UpdateMembershipPlanDto) {
    await this.findPlanById(id); // Check if exists

    const pricePerHour =
      updateDto.price && updateDto.hours
        ? updateDto.price / updateDto.hours
        : undefined;

    return this.prisma.membershipPlan.update({
      where: { id },
      data: {
        ...updateDto,
        ...(pricePerHour && { pricePerHour }),
      },
    });
  }

  async deletePlan(id: string) {
    await this.findPlanById(id); // Check if exists

    // Check if any active memberships exist
    const activeMemberships = await this.prisma.customerMembership.count({
      where: {
        planId: id,
        status: 'active',
      },
    });

    if (activeMemberships > 0) {
      throw new BadRequestException(
        `Cannot delete plan: ${activeMemberships} active memberships exist. Deactivate the plan instead.`
      );
    }

    return this.prisma.membershipPlan.delete({
      where: { id },
    });
  }

  // ========== CUSTOMER MEMBERSHIPS ==========

  async purchaseMembership(purchaseDto: PurchaseMembershipDto) {
    // Check if membership is enabled
    const isEnabled = await this.isMembershipEnabled();
    if (!isEnabled) {
      throw new BadRequestException('Membership system is currently disabled');
    }

    // Get plan details
    const plan = await this.findPlanById(purchaseDto.planId);
    if (!plan.isActive) {
      throw new BadRequestException('This membership plan is not active');
    }

    // Check if customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: purchaseDto.customerId },
    });
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${purchaseDto.customerId} not found`);
    }

    // Calculate expiry date
    const purchaseDate = new Date();
    const expiryDate = new Date(purchaseDate);
    expiryDate.setDate(expiryDate.getDate() + plan.validityDays);

    // Create membership
    const membership = await this.prisma.customerMembership.create({
      data: {
        customerId: purchaseDto.customerId,
        planId: purchaseDto.planId,
        purchaseDate,
        expiryDate,
        hoursTotal: plan.hours,
        hoursRemaining: plan.hours,
        hoursUsed: 0,
        status: 'active',
        paymentAmount: purchaseDto.paymentAmount || plan.price,
        paymentMode: purchaseDto.paymentMode || 'cash',
        notes: purchaseDto.notes,
        createdBy: purchaseDto.createdBy,
      },
      include: {
        plan: true,
        customer: true,
      },
    });

    return membership;
  }

  async getCustomerMemberships(customerId: string, activeOnly = false) {
    const where: any = { customerId };
    if (activeOnly) {
      where.status = 'active';
    }

    return this.prisma.customerMembership.findMany({
      where,
      include: {
        plan: true,
      },
      orderBy: { purchaseDate: 'desc' },
    });
  }

  async getActiveMembership(customerId: string, machineType?: string) {
    const where: any = {
      customerId,
      status: 'active',
      hoursRemaining: { gt: 0 },
      expiryDate: { gte: new Date() },
    };

    if (machineType) {
      where.plan = {
        machineType,
      };
    }

    return this.prisma.customerMembership.findFirst({
      where,
      include: {
        plan: true,
      },
      orderBy: { expiryDate: 'asc' }, // Use oldest first
    });
  }

  async deductHours(membershipId: string, hours: number) {
    const membership = await this.prisma.customerMembership.findUnique({
      where: { id: membershipId },
    });

    if (!membership) {
      throw new NotFoundException(`Membership with ID ${membershipId} not found`);
    }

    if (membership.status !== 'active') {
      throw new BadRequestException('Membership is not active');
    }

    const newHoursRemaining = Math.max(0, membership.hoursRemaining - hours);
    const newHoursUsed = membership.hoursUsed + hours;
    const newStatus = newHoursRemaining === 0 ? 'exhausted' : membership.status;

    return this.prisma.customerMembership.update({
      where: { id: membershipId },
      data: {
        hoursRemaining: newHoursRemaining,
        hoursUsed: newHoursUsed,
        status: newStatus,
      },
    });
  }

  async cancelMembership(id: string, reason?: string) {
    const membership = await this.prisma.customerMembership.findUnique({
      where: { id },
    });

    if (!membership) {
      throw new NotFoundException(`Membership with ID ${id} not found`);
    }

    return this.prisma.customerMembership.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelReason: reason,
      },
    });
  }

  // Cron job to update expired memberships
  async updateExpiredMemberships() {
    const now = new Date();

    const result = await this.prisma.customerMembership.updateMany({
      where: {
        status: 'active',
        expiryDate: { lt: now },
      },
      data: {
        status: 'expired',
      },
    });

    return result.count;
  }

  // ========== STATISTICS ==========

  async getMembershipStats() {
    const [totalActiveMemberships, totalRevenue, planStats] = await Promise.all([
      this.prisma.customerMembership.count({
        where: { status: 'active' },
      }),
      this.prisma.customerMembership.aggregate({
        _sum: { paymentAmount: true },
      }),
      this.prisma.membershipPlan.findMany({
        where: { isActive: true },
        include: {
          _count: {
            select: {
              customerMemberships: {
                where: { status: 'active' },
              },
            },
          },
        },
      }),
    ]);

    return {
      totalActiveMemberships,
      totalRevenue: totalRevenue._sum.paymentAmount || 0,
      planStats: planStats.map(plan => ({
        id: plan.id,
        name: plan.name,
        price: plan.price,
        activeMemberships: plan._count.customerMemberships,
      })),
    };
  }
}
