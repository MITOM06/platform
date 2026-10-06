import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Capability,
  JwtAuthGuard,
  JwtUser,
  RequirePermission,
  RequirePermissionGuard,
} from '@platform/database';
import { DashboardService } from './dashboard.service';
import { DashboardResponse } from './dashboard.types';
import { QuotaService } from './quota.service';
import { QuotaStatus } from './usage.service';

interface AuthedRequest {
  user: JwtUser;
}

/**
 * Usage routes. `GET /usage/dashboard` is the admin usage & quality dashboard
 * (TASK-13) — cross-user, gated by `MANAGE_WORKSPACE`. `GET /usage/quota` is the
 * caller's own monthly quota: JWT only (no capability), always scoped to
 * `req.user.sub`. The permission guard passes routes without `@RequirePermission`.
 */
@ApiTags('usage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RequirePermissionGuard)
@Controller('usage')
export class UsageController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly quotaService: QuotaService,
  ) {}

  @Get('dashboard')
  @RequirePermission(Capability.MANAGE_WORKSPACE)
  @ApiOperation({
    summary: 'Workspace-wide usage & quality dashboard (admin only)',
  })
  getDashboard(
    @Query('month') month?: string,
    @Query('days') days?: string,
  ): Promise<DashboardResponse> {
    const parsedDays = days !== undefined ? parseInt(days, 10) : undefined;
    return this.dashboardService.getDashboard({
      month: month || undefined,
      days: Number.isFinite(parsedDays) ? parsedDays : undefined,
    });
  }

  @Get('quota')
  @ApiOperation({
    summary: "The caller's AI token quota for the current period, exactly as enforced",
  })
  getQuota(@Req() req: AuthedRequest): Promise<QuotaStatus> {
    return this.quotaService.getQuota(req.user.sub);
  }
}
