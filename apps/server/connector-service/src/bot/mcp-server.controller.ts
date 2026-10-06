import { Controller, Logger, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { BotSessionGuard } from './bot-session.guard';
import {
  InternalService,
  SENSITIVE_ACTION_REQUIRES_CONFIRMATION,
} from '../internal/internal.service';

/** JSON-RPC error with an implementation-defined server code. */
class JsonRpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** JSON-RPC `error.code` for a write refused because it needs in-chat confirmation. */
export const SENSITIVE_ACTION_RPC_CODE = -32010;

/**
 * MCP Streamable HTTP server endpoint consumed by Bot Factory personal
 * assistant bots. Speaks a simplified MCP JSON-RPC protocol (initialize, ping,
 * tools/list, tools/call; notifications are acknowledged with 202).
 * Auth: Bearer bot session token + the owning member's live standing
 * (BotSessionGuard).
 *
 * Governance matches the AI path (allow-list, AI allowedConnectors, skills,
 * action-group grants, RBAC) and is stricter in one way: every write needs an
 * explicit in-chat user confirmation, which an external assistant cannot
 * show — so only read-only tools are listed, and calling a write returns
 * JSON-RPC error `-32010` with `data.code = SENSITIVE_ACTION_REQUIRES_CONFIRMATION`.
 *
 * Bot Factory adds this as a custom HTTP MCP server:
 *   URL:  https://<pon-host>/mcp
 *   Auth: Bearer <botSessionToken>
 */
@ApiTags('mcp-server')
@Controller('mcp')
@UseGuards(BotSessionGuard)
export class McpServerController {
  private readonly logger = new Logger(McpServerController.name);

  constructor(private readonly internal: InternalService) {}

  @Post()
  async handle(@Req() req: Request & { botSession: { userId: string } }, @Res() res: Response) {
    const { method, id, params } = (req.body ?? {}) as {
      method?: unknown;
      id?: string | number;
      params?: Record<string, unknown>;
    };
    if (typeof method === 'string' && method.startsWith('notifications/')) {
      return res.status(202).end();
    }
    const userId = req.botSession.userId;
    try {
      const result = await this.dispatch(typeof method === 'string' ? method : '', userId, params ?? {});
      return res.json({ jsonrpc: '2.0', id: id ?? null, result });
    } catch (err) {
      if (err instanceof JsonRpcError) {
        return res.status(200).json({
          jsonrpc: '2.0',
          id: id ?? null,
          error: { code: err.code, message: err.message, ...(err.data ? { data: err.data } : {}) },
        });
      }
      // Never echo internal error text to an external system.
      this.logger.error(`MCP ${String(method)} failed`, err as Error);
      return res.status(200).json({
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code: -32603, message: 'Internal error' },
      });
    }
  }

  private async dispatch(method: string, userId: string, params: Record<string, unknown>): Promise<unknown> {
    switch (method) {
      case 'initialize':
        return {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'pon-connector', version: '1.0.0' },
        };

      case 'ping':
        return {};

      case 'tools/list': {
        const { tools } = await this.internal.getTools(userId, 'bot');
        return {
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.input_schema,
            annotations: { readOnlyHint: true },
          })),
        };
      }

      case 'tools/call': {
        const name = params?.name;
        const args = params?.arguments ?? {};
        if (typeof name !== 'string' || !name || typeof args !== 'object' || Array.isArray(args)) {
          throw new JsonRpcError(-32602, 'Invalid params');
        }
        const outcome = await this.internal.callTool(userId, name, args as Record<string, unknown>, 'bot');
        if (outcome.refusal === SENSITIVE_ACTION_REQUIRES_CONFIRMATION) {
          throw new JsonRpcError(SENSITIVE_ACTION_RPC_CODE, SENSITIVE_ACTION_REQUIRES_CONFIRMATION, {
            code: SENSITIVE_ACTION_REQUIRES_CONFIRMATION,
            tool: name,
            reason: 'This action changes data and must be confirmed by the user in PON chat.',
          });
        }
        return {
          content: [{ type: 'text', text: outcome.result }],
          ...(outcome.result.startsWith('Tool error') ? { isError: true } : {}),
        };
      }

      default:
        throw new JsonRpcError(-32601, 'Method not found');
    }
  }
}
