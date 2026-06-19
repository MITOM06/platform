import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('ai')
@Controller()
export class AiController {
  @Get('health')
  @ApiOperation({ summary: 'AI service liveness probe' })
  @ApiResponse({
    status: 200,
    description: 'Service is up',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        service: { type: 'string', example: 'ai-service' },
      },
    },
  })
  health(): { status: string; service: string } {
    return { status: 'ok', service: 'ai-service' };
  }
}
