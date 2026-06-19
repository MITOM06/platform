import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ConnectionsService } from './connections.service';
import { CreateCustomMcpDto, DiscoverCustomMcpDto } from './dto/custom-mcp.dto';
import { SetSkillDto } from './dto/skill.dto';

@ApiTags('connections')
@Controller()
export class ConnectionsController {
  constructor(private readonly service: ConnectionsService) {}

  @Get('connections')
  @ApiOperation({ summary: 'List a user connections (no secrets)' })
  @ApiQuery({ name: 'userId', required: true })
  listConnections(@Query('userId') userId: string) {
    return this.service.listConnections(userId);
  }

  @Delete('connections/:id')
  @ApiOperation({ summary: 'Delete a connection' })
  deleteConnection(@Param('id') id: string) {
    return this.service.deleteConnection(id);
  }

  @Post('custom-mcp')
  @ApiOperation({ summary: 'Add a custom MCP server (encrypts credential)' })
  saveCustom(@Query('userId') userId: string, @Body() dto: CreateCustomMcpDto) {
    return this.service.saveCustom(userId, dto);
  }

  @Post('custom-mcp/discover')
  @ApiOperation({ summary: 'Preview tools of a custom MCP server (no save)' })
  discover(@Body() dto: DiscoverCustomMcpDto) {
    return this.service.discoverCustom(dto);
  }

  @Get('skills')
  @ApiOperation({ summary: 'List a user enabled skills' })
  @ApiQuery({ name: 'userId', required: true })
  listSkills(@Query('userId') userId: string) {
    return this.service.listSkills(userId);
  }

  @Put('skills')
  @ApiOperation({ summary: 'Enable/disable a skill for a user' })
  setSkill(@Body() dto: SetSkillDto) {
    return this.service.setSkill(dto.userId, dto.skillId, dto.enabled);
  }
}
