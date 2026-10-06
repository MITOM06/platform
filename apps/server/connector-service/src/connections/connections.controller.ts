import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Capability,
  CurrentUser,
  JwtAuthGuard,
  JwtUser,
  RequirePermission,
  RequirePermissionGuard,
} from '@platform/database';
import { ConnectionsService } from './connections.service';
import { CustomMcpService } from './custom-mcp.service';
import { CreateCustomMcpDto, DiscoverCustomMcpDto } from './dto/custom-mcp.dto';
import { UpdateConnectionPermissionsDto } from './dto/connection-permissions.dto';
import { SetSkillDto } from './dto/skill.dto';

@ApiTags('connections')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RequirePermissionGuard)
@Controller()
export class ConnectionsController {
  constructor(
    private readonly service: ConnectionsService,
    private readonly customMcp: CustomMcpService,
  ) {}

  @Get('connections')
  @ApiOperation({
    summary: 'List the caller personal + workspace connections (no secrets)',
  })
  listConnections(@CurrentUser() user: JwtUser) {
    return this.service.listConnections(user.sub);
  }

  @Delete('connections/:id')
  @ApiOperation({
    summary:
      'Disconnect (own personal connection, or a workspace connection with CONNECT_WORKSPACE_CONNECTOR)',
  })
  deleteConnection(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.deleteConnection(user, id);
  }

  @Get('connections/:id/permissions')
  @ApiOperation({ summary: 'Get the action groups the AI may use on a connection' })
  getConnectionPermissions(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.getConnectionPermissions(user.sub, id);
  }

  @Put('connections/:id/permissions')
  @ApiOperation({ summary: 'Set the action groups the AI may use on a connection' })
  updateConnectionPermissions(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateConnectionPermissionsDto,
  ) {
    return this.service.updateConnectionPermissions(user.sub, id, dto.actionGroups);
  }

  // ── Custom MCP servers ──────────────────────────────────────────────────

  @Get('custom-mcp')
  @ApiOperation({ summary: "List the caller's custom MCP servers (no secrets, redacted URLs)" })
  listCustom(@CurrentUser() user: JwtUser) {
    return this.customMcp.list(user.sub);
  }

  @Post('custom-mcp')
  @RequirePermission(Capability.ADD_CUSTOM_MCP)
  @ApiOperation({ summary: 'Add a custom MCP server (encrypts credential)' })
  saveCustom(@CurrentUser() user: JwtUser, @Body() dto: CreateCustomMcpDto) {
    return this.customMcp.save(user.sub, dto);
  }

  @Post('custom-mcp/discover')
  @RequirePermission(Capability.ADD_CUSTOM_MCP)
  @ApiOperation({ summary: 'Preview tools of a custom MCP server (no save)' })
  discover(@Body() dto: DiscoverCustomMcpDto) {
    return this.customMcp.discover(dto);
  }

  @Delete('custom-mcp/:id')
  @ApiOperation({ summary: "Delete one of the caller's custom MCP servers (idempotent)" })
  deleteCustom(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.customMcp.remove(user.sub, id);
  }

  // ── Skills ──────────────────────────────────────────────────────────────

  @Get('skills')
  @ApiOperation({ summary: 'List the caller enabled skills' })
  listSkills(@CurrentUser() user: JwtUser) {
    return this.service.listSkills(user.sub);
  }

  @Put('skills')
  @ApiOperation({ summary: 'Enable/disable a skill for the caller' })
  setSkill(@CurrentUser() user: JwtUser, @Body() dto: SetSkillDto) {
    return this.service.setSkill(user.sub, dto.skillId, dto.enabled);
  }
}
