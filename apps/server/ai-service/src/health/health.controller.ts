import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly startedAt = new Date();

  @Get()
  @ApiOperation({ summary: 'Health check with uptime' })
  @ApiResponse({
    status: 200,
    description: 'Service health',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean', example: true },
        uptime: { type: 'number', example: 42 },
        ts: { type: 'string', format: 'date-time' },
      },
    },
  })
  ok() {
    const uptimeSeconds = Math.floor((Date.now() - this.startedAt.getTime()) / 1000);
    return { ok: true, uptime: uptimeSeconds, ts: new Date().toISOString() };
  }
}
