import { Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { BotSessionGuard } from './bot-session.guard';
import { InternalService } from '../internal/internal.service';

/**
 * MCP Streamable HTTP server endpoint consumed by Bot Factory personal
 * assistant bots. Speaks a simplified MCP JSON-RPC protocol (initialize,
 * tools/list, tools/call). Auth: Bearer bot session token.
 *
 * Bot Factory adds this as a custom HTTP MCP server:
 *   URL:  https://<pon-host>/mcp
 *   Auth: Bearer <botSessionToken>
 */
@ApiTags('mcp-server')
@Controller('mcp')
@UseGuards(BotSessionGuard)
export class McpServerController {
  constructor(private readonly internal: InternalService) {}

  @Post()
  async handle(@Req() req: Request & { botSession: { userId: string } }, @Res() res: Response) {
    const { method, id, params } = (req.body ?? {}) as {
      method?: string;
      id?: string | number;
      params?: Record<string, unknown>;
    };
    const userId = req.botSession.userId;

    try {
      const result = await this.dispatch(method ?? '', userId, params ?? {});
      return res.json({ jsonrpc: '2.0', id: id ?? null, result });
    } catch (err) {
      return res.status(200).json({
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code: -32603, message: (err as Error).message },
      });
    }
  }

  private async dispatch(
    method: string,
    userId: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    switch (method) {
      case 'initialize':
        return {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'pon-connector', version: '1.0.0' },
        };

      case 'tools/list': {
        const { tools } = await this.internal.getTools(userId);
        return {
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.input_schema,
          })),
        };
      }

      case 'tools/call': {
        const name = params.name as string;
        const args = (params.arguments ?? {}) as Record<string, unknown>;
        const { result } = await this.internal.callTool(userId, name, args);
        return { content: [{ type: 'text', text: result }] };
      }

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }
}
