import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConnectorPolicy } from '../governance/connector-policy';
import { ConnectorPolicyService } from '../governance/connector-policy.service';
import { CATALOG, CatalogEntryView, toCatalogView } from './catalog';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly policyService: ConnectorPolicyService) {}

  @Get()
  @ApiOperation({
    summary:
      'List built-in connectors (public view, no OAuth secrets), each flagged with whether the workspace allow-list lets anyone connect it',
  })
  async list(): Promise<CatalogEntryView[]> {
    // Display hint only — connect is still enforced server-side, so an unreadable
    // policy falls back to "allowed" rather than hiding every connector.
    const policy = await this.policyService.loadPolicy().catch(() => ConnectorPolicy.allowAll());
    return CATALOG.map((entry) => ({
      ...toCatalogView(entry),
      allowedByWorkspace: policy.workspaceAllows(entry.id),
    }));
  }
}
