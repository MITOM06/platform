import { Controller, Get } from '@nestjs/common';

@Controller()
export class AiController {
  @Get('health')
  health(): { status: string; service: string } {
    return { status: 'ok', service: 'ai-service' };
  }
}
