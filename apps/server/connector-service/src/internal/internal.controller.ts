import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InternalKeyGuard } from './internal-key.guard';
import { InternalService } from './internal.service';

class CallToolDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsObject()
  input?: Record<string, unknown>;
}

@ApiTags('internal')
@UseGuards(InternalKeyGuard)
@Controller('internal')
export class InternalController {
  constructor(private readonly service: InternalService) {}

  @Get('tools')
  @ApiOperation({ summary: 'Aggregated dynamic tools for a user (ai-service)' })
  @ApiQuery({ name: 'userId', required: true })
  getTools(@Query('userId') userId: string) {
    return this.service.getTools(userId);
  }

  @Post('tools/call')
  @ApiOperation({ summary: 'Execute a dynamic tool by namespaced name' })
  callTool(@Body() dto: CallToolDto) {
    return this.service.callTool(dto.userId, dto.name, dto.input ?? {});
  }
}
