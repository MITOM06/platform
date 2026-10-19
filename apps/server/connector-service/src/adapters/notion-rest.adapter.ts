import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SingleFlight } from '../common/single-flight';
import { connectionExpired, httpFailure, ToolExecutionError } from '../internal/tool-errors';
import { McpTool } from '../mcp/mcp-client.service';
import { parseOAuthErrorCode } from '../oauth/oauth-errors';
import { EncBlob, TokenVaultService } from '../vault/token-vault.service';
import {
  UserConnection,
  UserConnectionDocument,
} from '../connections/schemas/user-connection.schema';
import {
  blockText,
  NotionBlock,
  NotionObject,
  notionErrorReason,
  notionId,
  paragraphs,
  propText,
  richText,
  titleOf,
} from './notion-format';
import { NOTION_TOOLS } from './notion-tools';
import { ConnectionLike, ProviderAdapter, RevokeOutcome } from './provider-adapter.interface';

const NOTION_API = 'https://api.notion.com/v1';
/** Pinned so response shapes stay stable; see developers.notion.com/reference/versioning. */
const NOTION_VERSION = '2026-03-11';
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RESULTS = 20;
/** One Notion request holds at most 100 blocks. */
const MAX_BLOCKS = 100;

interface NotionTokens {
  access_token: string;
  refresh_token?: string;
  [k: string]: unknown;
}

/** A refreshed pair: the new access token and the encrypted blob that now holds it. */
interface Refreshed {
  token: string;
  blob: EncBlob;
}

function clampInt(value: unknown, fallback: number, max: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

/**
 * Exposes Notion as MCP-shaped tools backed by the Notion REST API, using the
 * member's OAuth token from the catalog connect flow (see notion-tools.ts for
 * why not the hosted MCP). Failures are thrown as `ToolExecutionError` with a
 * code and a short sentence; Notion's response body is never forwarded.
 */
@Injectable()
export class NotionRestAdapter implements ProviderAdapter {
  private readonly logger = new Logger(NotionRestAdapter.name);
  /** One refresh per connection at a time: Notion rotates refresh tokens, so a second
   *  parallel refresh with the same (already spent) token would fail with invalid_grant. */
  private readonly refreshes = new SingleFlight<Refreshed | null>();

  constructor(
    private readonly vault: TokenVaultService,
    private readonly cfg: ConfigService,
    @InjectModel(UserConnection.name)
    private readonly connModel: Model<UserConnectionDocument>,
  ) {}

  listTools(_conn: ConnectionLike): Promise<McpTool[]> {
    return Promise.resolve(NOTION_TOOLS);
  }

  async callTool(conn: ConnectionLike, tool: string, input: Record<string, unknown>): Promise<string> {
    switch (tool) {
      case 'search_pages':
        return this.searchPages(conn, input);
      case 'get_page':
        return this.getPage(conn, input);
      case 'query_data_source':
        return this.queryDataSource(conn, input);
      case 'create_page':
        return this.createPage(conn, input);
      case 'update_page':
        return this.updatePage(conn, input);
      case 'update_page_content':
        return this.appendContent(conn, input);
      default:
        throw new ToolExecutionError('UNKNOWN_TOOL', `Unknown notion tool ${tool}.`);
    }
  }

  private async searchPages(conn: ConnectionLike, input: Record<string, unknown>): Promise<string> {
    const body: Record<string, unknown> = { page_size: clampInt(input.maxResults, 10, MAX_RESULTS) };
    if (input.query) body.query = String(input.query);
    if (input.type === 'page' || input.type === 'data_source') {
      body.filter = { property: 'object', value: input.type };
    }
    const res = await this.request(conn, 'POST', '/search', body);
    if (!res.ok) throw await this.failure(res);
    const results = ((await res.json()) as { results?: NotionObject[] }).results ?? [];
    if (results.length === 0) {
      return (
        'Found 0 result(s). Notion only sees pages shared with this connection: ' +
        'open the page in Notion, then ••• → Connections → add the PON connection.'
      );
    }
    const lines = results.map((r) =>
      `- [${r.object}] ${titleOf(r)} (id: ${r.id}) ${r.url ?? ''}`.trimEnd(),
    );
    return [`Found ${results.length} result(s):`, ...lines].join('\n');
  }

  private async getPage(conn: ConnectionLike, input: Record<string, unknown>): Promise<string> {
    const id = notionId(input.pageId, 'pageId');
    const pageRes = await this.request(conn, 'GET', `/pages/${id}`);
    if (!pageRes.ok) throw await this.failure(pageRes);
    const page = (await pageRes.json()) as NotionObject;
    const blocksRes = await this.request(conn, 'GET', `/blocks/${id}/children?page_size=${MAX_BLOCKS}`);
    if (!blocksRes.ok) throw await this.failure(blocksRes);
    const blocks = (await blocksRes.json()) as { results?: NotionBlock[]; has_more?: boolean };
    const header = `${titleOf(page)} (id: ${page.id}) ${page.url ?? ''}`.trimEnd();
    const lines = (blocks.results ?? []).map(blockText).filter(Boolean);
    if (blocks.has_more) lines.push('(more content not shown)');
    return [header, ...lines].join('\n');
  }

  private async queryDataSource(conn: ConnectionLike, input: Record<string, unknown>): Promise<string> {
    const id = notionId(input.dataSourceId, 'dataSourceId');
    const body: Record<string, unknown> = { page_size: clampInt(input.maxResults, 10, MAX_RESULTS) };
    if (input.filter && typeof input.filter === 'object') body.filter = input.filter;
    const res = await this.request(conn, 'POST', `/data_sources/${id}/query`, body);
    if (!res.ok) throw await this.failure(res);
    const rows = ((await res.json()) as { results?: NotionObject[] }).results ?? [];
    const lines = rows.map((r) => {
      const props = Object.entries(r.properties ?? {})
        .map(([name, p]) => {
          const v = propText(p);
          return v === null ? null : `${name}: ${v}`;
        })
        .filter((x): x is string => x !== null);
      return [`- ${titleOf(r)} (id: ${r.id})`, ...props].join(' | ');
    });
    return [`Found ${rows.length} row(s):`, ...lines].join('\n');
  }

  private async createPage(conn: ConnectionLike, input: Record<string, unknown>): Promise<string> {
    const title = String(input.title ?? '').trim();
    if (!title || !input.parentPageId === !input.dataSourceId) {
      throw new ToolExecutionError('INVALID_INPUT', 'create_page needs a title and exactly one of parentPageId or dataSourceId.');
    }
    const children = input.content ? paragraphs(String(input.content)) : [];
    if (children.length > MAX_BLOCKS) {
      throw new ToolExecutionError('INVALID_INPUT', `content has more than ${MAX_BLOCKS} lines; split it across update_page_content calls.`);
    }
    let parent: Record<string, string>;
    let titleKey = 'title';
    if (input.dataSourceId) {
      const dsId = notionId(input.dataSourceId, 'dataSourceId');
      // A data source row is titled through whichever property has type 'title'.
      const dsRes = await this.request(conn, 'GET', `/data_sources/${dsId}`);
      if (!dsRes.ok) throw await this.failure(dsRes);
      const ds = (await dsRes.json()) as NotionObject;
      titleKey = Object.entries(ds.properties ?? {}).find(([, p]) => p.type === 'title')?.[0] ?? 'title';
      parent = { type: 'data_source_id', data_source_id: dsId };
    } else {
      parent = { type: 'page_id', page_id: notionId(input.parentPageId, 'parentPageId') };
    }
    const body: Record<string, unknown> = { parent, properties: { [titleKey]: { title: richText(title) } } };
    if (children.length) body.children = children;
    const res = await this.request(conn, 'POST', '/pages', body);
    if (!res.ok) throw await this.failure(res);
    const page = (await res.json()) as NotionObject;
    return `Page "${title}" created (id: ${page.id}) ${page.url ?? ''}`.trimEnd();
  }

  private async updatePage(conn: ConnectionLike, input: Record<string, unknown>): Promise<string> {
    const id = notionId(input.pageId, 'pageId');
    if (!input.title && !input.properties) {
      throw new ToolExecutionError('INVALID_INPUT', 'update_page needs a title or properties to change.');
    }
    const properties: Record<string, unknown> = {
      ...((input.properties as Record<string, unknown> | undefined) ?? {}),
    };
    if (input.title) properties.title = { title: richText(String(input.title)) };
    const res = await this.request(conn, 'PATCH', `/pages/${id}`, { properties });
    if (!res.ok) throw await this.failure(res);
    const page = (await res.json()) as NotionObject;
    return `Page ${id} updated ${page.url ?? ''}`.trimEnd();
  }

  private async appendContent(conn: ConnectionLike, input: Record<string, unknown>): Promise<string> {
    const id = notionId(input.pageId, 'pageId');
    const children = paragraphs(String(input.content ?? ''));
    if (children.length === 0) {
      throw new ToolExecutionError('INVALID_INPUT', 'update_page_content needs some content to add.');
    }
    if (children.length > MAX_BLOCKS) {
      throw new ToolExecutionError('INVALID_INPUT', `content has more than ${MAX_BLOCKS} lines; send it in several calls.`);
    }
    const res = await this.request(conn, 'PATCH', `/blocks/${id}/children`, { children });
    if (!res.ok) throw await this.failure(res);
    return `Added ${children.length} paragraph(s) to page ${id}`;
  }

  // ── HTTP + token plumbing ───────────────────────────────────────────────────
  /** Authenticated Notion call; a 401 triggers one refresh and one retry. */
  private async request(conn: ConnectionLike, method: string, path: string, body?: unknown): Promise<Response> {
    const send = (token: string) =>
      fetch(`${NOTION_API}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Notion-Version': NOTION_VERSION,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

    const token = this.decode(conn.encryptedTokens).access_token;
    const res = await send(token);
    if (res.status !== 401) return res;
    const refreshed = await this.refresh(conn, token);
    if (!refreshed) return res;
    // Later requests of this tool call must read the new pair: the old refresh
    // token is spent, so refreshing again from it would fail.
    conn.encryptedTokens = refreshed.blob;
    return refreshed.token === token ? res : send(refreshed.token);
  }

  private decode(blob: ConnectionLike['encryptedTokens']): NotionTokens {
    return JSON.parse(this.vault.decrypt(blob!)) as NotionTokens;
  }

  private basicAuth(): string {
    const notion = this.cfg.get<{ clientId: string; clientSecret: string }>('notion');
    return `Basic ${Buffer.from(`${notion?.clientId ?? ''}:${notion?.clientSecret ?? ''}`).toString('base64')}`;
  }

  private refresh(conn: ConnectionLike, rejectedToken: string): Promise<Refreshed | null> {
    return this.refreshes.run(String(conn._id ?? conn.provider), () => this.refreshLatest(conn, rejectedToken));
  }

  /**
   * Refresh from the STORED tokens: another request (or instance) may already
   * have rotated them, in which case their access token is simply used. A dead
   * grant marks the connection `expired` so the tile asks to reconnect.
   */
  private async refreshLatest(conn: ConnectionLike, rejectedToken: string): Promise<Refreshed | null> {
    let blob = conn.encryptedTokens!;
    let tokens = this.decode(blob);
    if (conn._id) {
      const latest = await this.connModel
        .findById(conn._id, { encryptedTokens: 1, status: 1 })
        .lean<{ encryptedTokens?: EncBlob; status?: string }>();
      if (latest?.status && latest.status !== 'active') throw connectionExpired(conn.provider);
      if (latest?.encryptedTokens) {
        blob = latest.encryptedTokens;
        tokens = this.decode(blob);
      }
    }
    if (tokens.access_token !== rejectedToken) return { token: tokens.access_token, blob };
    if (!tokens.refresh_token) {
      await this.markExpired(conn);
      throw connectionExpired(conn.provider);
    }

    const res = await fetch(`${NOTION_API}/oauth/token`, {
      method: 'POST',
      headers: { Authorization: this.basicAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      const oauthError = parseOAuthErrorCode(await res.text().catch(() => ''));
      if (oauthError === 'invalid_grant') {
        await this.markExpired(conn);
        throw connectionExpired(conn.provider);
      }
      this.logger.warn(`Notion token refresh failed (${res.status}${oauthError ? ` ${oauthError}` : ''})`);
      return null;
    }
    // Keep the workspace fields (bot_id, workspace_name, …) next to the rotated pair.
    const merged: NotionTokens = { ...tokens, ...((await res.json()) as NotionTokens) };
    const newBlob = this.vault.encrypt(JSON.stringify(merged));
    if (conn._id) {
      await this.connModel.updateOne({ _id: conn._id }, { $set: { encryptedTokens: newBlob } });
    }
    return { token: merged.access_token, blob: newBlob };
  }

  private async markExpired(conn: ConnectionLike): Promise<void> {
    if (!conn._id) return;
    try {
      await this.connModel.updateOne({ _id: conn._id }, { $set: { status: 'expired' } });
      this.logger.warn(`Marked ${conn.provider} connection ${String(conn._id)} expired`);
    } catch (err) {
      this.logger.warn(`Could not mark ${conn.provider} expired: ${(err as Error).message}`);
    }
  }

  /** Best-effort: tell Notion to drop the grant before the connection is deleted. */
  async revoke(conn: ConnectionLike): Promise<RevokeOutcome> {
    try {
      if (!conn.encryptedTokens) return 'skipped';
      const token = this.decode(conn.encryptedTokens).access_token;
      if (!token) return 'skipped';
      const res = await fetch(`${NOTION_API}/oauth/revoke`, {
        method: 'POST',
        headers: { Authorization: this.basicAuth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      return res.ok ? 'revoked' : 'failed';
    } catch (err) {
      this.logger.warn(`Notion revoke failed: ${(err as Error).message}`);
      return 'failed';
    }
  }

  /** Map a failed Notion response to a clean tool error; the body is only logged. */
  private async failure(res: Response): Promise<ToolExecutionError> {
    const text = await res.text().catch(() => '');
    this.logger.warn(`Notion API ${res.status}: ${text.slice(0, 300)}`);
    const reason = notionErrorReason(text);
    if (res.status === 404 && reason === 'object_not_found') {
      return new ToolExecutionError(
        'NOT_FOUND',
        'Notion could not find that item, or it may not be shared with this connection: ' +
          'in Notion open it, then ••• → Connections → add the PON connection.',
      );
    }
    return httpFailure('Notion', res.status, reason);
  }
}
