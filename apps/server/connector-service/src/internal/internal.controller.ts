import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsObject, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InternalKeyGuard } from './internal-key.guard';
import { InternalService } from './internal.service';

/**
 * Member ids are plain strings (Mongo ObjectIds in practice). Validating the
 * shape keeps a query like `?userId[$ne]=x` (or a JSON object in the body)
 * from ever reaching a Mongo filter as an operator, should the internal key leak.
 */
export const USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export class ToolsQueryDto {
  @IsString()
  @Matches(USER_ID_PATTERN, { message: 'userId must be a plain id' })
  userId: string;
}

export class CallToolDto {
  @IsString()
  @Matches(USER_ID_PATTERN, { message: 'userId must be a plain id' })
  userId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
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
  getTools(@Query() query: ToolsQueryDto) {
    return this.service.getTools(query.userId);
  }

  @Post('tools/call')
  @ApiOperation({ summary: 'Execute a dynamic tool by namespaced name' })
  async callTool(@Body() dto: CallToolDto) {
    const { result } = await this.service.callTool(dto.userId, dto.name, dto.input ?? {});
    return { result };
  }
}
