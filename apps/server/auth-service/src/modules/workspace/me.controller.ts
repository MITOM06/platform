import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClaimsService } from '../auth/claims.service';
import { WorkspaceService } from './workspace.service';

/**
 * Caller-scoped identity endpoints. `GET /me/capabilities` lets web + Flutter
 * gate their UI to the member's role/permissions and read the workspace public
 * config (branding/features/allow-list).
 */
@ApiTags('me')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('me')
export class MeController {
  constructor(
    private readonly claims: ClaimsService,
    private readonly workspace: WorkspaceService,
  ) {}

  @Get('capabilities')
  @ApiOperation({ summary: 'Resolved role/permissions/departments + workspace config' })
  async capabilities(@Req() req: any) {
    const resolved = await this.claims.resolve(req.user.sub);
    const workspace = await this.workspace.getPublicConfig();
    return { ...resolved, workspace };
  }
}
