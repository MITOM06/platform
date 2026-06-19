import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
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
import { CreateCustomMcpDto, DiscoverCustomMcpDto } from './dto/custom-mcp.dto';
import { SetSkillDto } from './dto/skill.dto';

@ApiTags('connections')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RequirePermissionGuard)
@Controller()
export class ConnectionsController {
  constructor(private readonly service: ConnectionsService) {}

  @Get('connections')
  @ApiOperation({
    summary: 'List the caller personal + workspace connections (no secrets)',
  })
  listConnections(@CurrentUser() user: JwtUser) {
    return this.service.listConnections(user.sub);
  }

  @Delete('connections/:id')
  @ApiOperation({ summary: 'Delete one of the caller connections' })
  deleteConnection(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.deleteConnection(user.sub, id);
  }

  @Post('custom-mcp')
  @RequirePermission(Capability.ADD_CUSTOM_MCP)
  @ApiOperation({ summary: 'Add a custom MCP server (encrypts credential)' })
  saveCustom(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateCustomMcpDto,
  ) {
    return this.service.saveCustom(user.sub, dto);
  }

  @Post('custom-mcp/discover')
  @RequirePermission(Capability.ADD_CUSTOM_MCP)
  @ApiOperation({ summary: 'Preview tools of a custom MCP server (no save)' })
  discover(@Body() dto: DiscoverCustomMcpDto) {
    return this.service.discoverCustom(dto);
  }

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
