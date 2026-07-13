import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Capability, CurrentUser, JwtUser } from '@platform/database';
import {
  RequirePermission,
  RequirePermissionGuard,
} from '../auth/guards/require-permission.guard';
import { AiContextService } from './ai-context.service';
import {
  UpdateHardContextDto,
  UpdateSoftContextDto,
  UpsertEntryDto,
} from './dto/ai-context.dto';

@ApiTags('ai-context')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RequirePermissionGuard)
@Controller('ai-context')
export class AiContextController {
  constructor(private readonly service: AiContextService) {}

  /** Department ids the caller belongs to (JWT `depts` claim). */
  private deptIds(user: JwtUser): string[] {
    return (user.depts ?? []).map((d) => String(d));
  }

  @Get('me')
  async getMine(@CurrentUser() user: JwtUser) {
    const depts = this.deptIds(user);
    const [context, entries, departmentNames] = await Promise.all([
      this.service.getUserContext(user.sub),
      this.service.getVisibleEntriesForUser(user.sub, user.perms ?? [], depts),
      this.service.resolveDepartmentNames(depts),
    ]);
    return {
      context,
      identity: { role: user.role ?? null, departmentNames },
      entries,
    };
  }

  @Patch('me/style')
  updateMyStyle(@CurrentUser() user: JwtUser, @Body() dto: UpdateSoftContextDto) {
    return this.service.updateSoftContext(user.sub, dto);
  }

  @Get('users/:userId')
  getUser(@Param('userId') userId: string) {
    return this.service.getUserContext(userId);
  }

  @Patch('users/:userId/hard')
  updateHard(
    @CurrentUser() user: JwtUser,
    @Param('userId') userId: string,
    @Body() dto: UpdateHardContextDto,
  ) {
    return this.service.updateHardContext(
      { sub: user.sub, perms: user.perms ?? [] },
      userId,
      dto,
    );
  }

  @Get('entries')
  @RequirePermission(Capability.MANAGE_AI_CONTEXT)
  listEntries(
    @Query('scope') scope: 'company' | 'department',
    @Query('scopeId') scopeId?: string,
  ) {
    return this.service.listEntries(scope, scopeId ?? null);
  }

  @Post('entries')
  createEntry(@CurrentUser() user: JwtUser, @Body() dto: UpsertEntryDto) {
    return this.service.upsertEntry(
      { sub: user.sub, perms: user.perms ?? [] },
      dto,
    );
  }

  @Patch('entries/:id')
  updateEntry(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpsertEntryDto,
  ) {
    return this.service.upsertEntry(
      { sub: user.sub, perms: user.perms ?? [] },
      dto,
      id,
    );
  }

  @Delete('entries/:id')
  @HttpCode(204)
  deleteEntry(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.deleteEntry(
      { sub: user.sub, perms: user.perms ?? [] },
      id,
    );
  }
}
