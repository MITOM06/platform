import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Capability,
  JwtAuthGuard,
  RequirePermission,
  RequirePermissionGuard,
} from '@platform/database';
import { DashboardService } from './dashboard.service';
import { DashboardResponse } from './dashboard.types';

/**
 * Admin usage & quality dashboard (TASK-13). First ai-service controller to use
 * the shared `JwtAuthGuard` + `RequirePermissionGuard`. Cross-user aggregate —
 * gated by the existing `MANAGE_WORKSPACE` capability (no new capability).
 */
@ApiTags('usage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RequirePermissionGuard)
@Controller('usage')
export class UsageController {
  constructor(private readonly dashboardService: DashboardService) {}

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
}
