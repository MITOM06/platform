import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CATALOG, CatalogEntryView, toCatalogView } from './catalog';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  @Get()
  @ApiOperation({
    summary: 'List built-in connectors (public view, no OAuth secrets)',
  })
  list(): CatalogEntryView[] {
    return CATALOG.map(toCatalogView);
  }
}
