import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Capability } from '@platform/database';
import {
  RequirePermission,
  RequirePermissionGuard,
} from '../auth/guards/require-permission.guard';
import { AdminService } from './admin.service';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
} from './dto/department.dto';
import { UpdateMemberDto } from './dto/member.dto';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { UpdateWorkspaceDto } from './dto/workspace.dto';

/**
 * Admin console API for the enterprise foundation. Every route requires a valid
 * JWT plus the declared capability (read from the token's `perms` claim).
 */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RequirePermissionGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ===================== DEPARTMENTS =====================
  @Get('departments')
  @RequirePermission(Capability.MANAGE_DEPARTMENTS)
  @ApiOperation({ summary: 'List departments' })
  listDepartments() {
    return this.adminService.listDepartments();
  }

  @Post('departments')
  @RequirePermission(Capability.MANAGE_DEPARTMENTS)
  createDepartment(@Body() dto: CreateDepartmentDto) {
    return this.adminService.createDepartment(dto);
  }

  @Patch('departments/:id')
  @RequirePermission(Capability.MANAGE_DEPARTMENTS)
  updateDepartment(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.adminService.updateDepartment(id, dto);
  }

  @Delete('departments/:id')
  @RequirePermission(Capability.MANAGE_DEPARTMENTS)
  deleteDepartment(@Param('id') id: string) {
    return this.adminService.deleteDepartment(id);
  }

  // ===================== MEMBERS =====================
  @Get('members')
  @RequirePermission(Capability.MANAGE_MEMBERS)
  @ApiOperation({ summary: 'List members' })
  listMembers() {
    return this.adminService.listMembers();
  }

  @Patch('members/:id')
  @RequirePermission(Capability.MANAGE_MEMBERS)
  @ApiOperation({ summary: 'Assign role/departments; revokes user sessions' })
  updateMember(@Param('id') id: string, @Body() dto: UpdateMemberDto) {
    return this.adminService.updateMember(id, dto);
  }

  // ===================== ROLES =====================
  @Get('roles')
  @RequirePermission(Capability.MANAGE_ROLES)
  listRoles() {
    return this.adminService.listRoles();
  }

  @Post('roles')
  @RequirePermission(Capability.MANAGE_ROLES)
  @ApiOperation({ summary: 'Create / clone a role' })
  createRole(@Body() dto: CreateRoleDto) {
    return this.adminService.createRole(dto);
  }

  @Patch('roles/:id')
  @RequirePermission(Capability.MANAGE_ROLES)
  @ApiOperation({ summary: 'Edit a role (Owner is immutable)' })
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.adminService.updateRole(id, dto);
  }

  // ===================== WORKSPACE =====================
  @Get('workspace')
  @RequirePermission(Capability.MANAGE_WORKSPACE)
  getWorkspace() {
    return this.adminService.getWorkspace();
  }

  @Patch('workspace')
  @RequirePermission(Capability.MANAGE_WORKSPACE)
  @ApiOperation({ summary: 'Update workspace name/branding/features/allow-list' })
  updateWorkspace(@Body() dto: UpdateWorkspaceDto) {
    return this.adminService.updateWorkspace(dto);
  }
}
