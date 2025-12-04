import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MembershipsService } from './memberships.service';
import { CreateMembershipPlanDto } from './dto/create-membership-plan.dto';
import { UpdateMembershipPlanDto } from './dto/update-membership-plan.dto';
import { PurchaseMembershipDto } from './dto/purchase-membership.dto';

@Controller('memberships')
@UseGuards(JwtAuthGuard)
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  // ========== SYSTEM SETTINGS ==========

  @Get('enabled')
  async isMembershipEnabled() {
    const enabled = await this.membershipsService.isMembershipEnabled();
    return { enabled };
  }

  // ========== MEMBERSHIP PLANS ==========

  @Post('plans')
  createPlan(@Body() createDto: CreateMembershipPlanDto) {
    return this.membershipsService.createPlan(createDto);
  }

  @Get('plans')
  findAllPlans(@Query('includeInactive') includeInactive?: string) {
    return this.membershipsService.findAllPlans(includeInactive === 'true');
  }

  @Get('plans/:id')
  findPlanById(@Param('id') id: string) {
    return this.membershipsService.findPlanById(id);
  }

  @Put('plans/:id')
  updatePlan(@Param('id') id: string, @Body() updateDto: UpdateMembershipPlanDto) {
    return this.membershipsService.updatePlan(id, updateDto);
  }

  @Delete('plans/:id')
  deletePlan(@Param('id') id: string) {
    return this.membershipsService.deletePlan(id);
  }

  // ========== CUSTOMER MEMBERSHIPS ==========

  @Post('purchase')
  purchaseMembership(@Body() purchaseDto: PurchaseMembershipDto) {
    return this.membershipsService.purchaseMembership(purchaseDto);
  }

  @Get('customer/:customerId')
  getCustomerMemberships(
    @Param('customerId') customerId: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.membershipsService.getCustomerMemberships(
      customerId,
      activeOnly === 'true',
    );
  }

  @Get('customer/:customerId/active')
  getActiveMembership(
    @Param('customerId') customerId: string,
    @Query('machineType') machineType?: string,
  ) {
    return this.membershipsService.getActiveMembership(customerId, machineType);
  }

  @Post(':id/cancel')
  cancelMembership(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.membershipsService.cancelMembership(id, reason);
  }

  // ========== STATISTICS ==========

  @Get('stats/overview')
  getMembershipStats() {
    return this.membershipsService.getMembershipStats();
  }
}
