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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Capability,
  CurrentUser,
  JwtAuthGuard,
  JwtUser,
  RequirePermission,
  RequirePermissionGuard,
} from '@platform/database';
import { DirectoryService } from './directory.service';
import {
  CreateDirectoryEntryDto,
  UpdateDirectoryEntryDto,
} from './dto/directory.dto';

@ApiTags('directory')
@Controller('directory')
export class DirectoryController {
  constructor(private readonly service: DirectoryService) {}

  // Public list — any authenticated member may browse the directory.
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List available MCP directory entries (no secrets)' })
  list() {
    return this.service.list();
  }

  // ── Admin CRUD (MANAGE_WORKSPACE) ────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RequirePermissionGuard)
  @RequirePermission(Capability.MANAGE_WORKSPACE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a custom directory entry (admin)' })
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateDirectoryEntryDto) {
    return this.service.create(user.sub, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RequirePermissionGuard)
  @RequirePermission(Capability.MANAGE_WORKSPACE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a directory entry (admin)' })
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateDirectoryEntryDto,
  ) {
    return this.service.update(user.sub, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RequirePermissionGuard)
  @RequirePermission(Capability.MANAGE_WORKSPACE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a custom directory entry (admin)' })
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.remove(user.sub, id);
  }
}
