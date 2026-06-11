import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  private readonly startedAt = new Date();

  @Get()
  ok() {
    const uptimeSeconds = Math.floor((Date.now() - this.startedAt.getTime()) / 1000);
    return { ok: true, uptime: uptimeSeconds, ts: new Date().toISOString() };
  }
}
