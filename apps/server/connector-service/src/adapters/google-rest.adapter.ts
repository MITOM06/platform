import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { McpTool } from '../mcp/mcp-client.service';
import { TokenVaultService } from '../vault/token-vault.service';
import {
  UserConnection,
  UserConnectionDocument,
} from '../connections/schemas/user-connection.schema';
import { ConnectionLike, ProviderAdapter } from './provider-adapter.interface';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
const CAL_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary';

interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  [k: string]: unknown;
}

const obj = (
  properties: Record<string, unknown>,
  required: string[] = [],
) => ({ type: 'object', properties, required });

const GMAIL_TOOLS: McpTool[] = [
  {
    name: 'send_email',
    description: "Send an email on the user's behalf.",
    inputSchema: obj(
      { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } },
      ['to', 'subject', 'body'],
    ),
  },
  {
    name: 'create_draft',
    description: 'Create a Gmail draft without sending it.',
    inputSchema: obj(
      { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } },
      ['to', 'subject', 'body'],
    ),
  },
  {
    name: 'search_threads',
    description: 'Search the user Gmail threads.',
    inputSchema: obj(
      { query: { type: 'string' }, maxResults: { type: 'number' } },
      ['query'],
    ),
  },
];

const CALENDAR_TOOLS: McpTool[] = [
  {
    name: 'list_events',
    description: 'List upcoming calendar events.',
    inputSchema: obj({
      timeMin: { type: 'string' },
      timeMax: { type: 'string' },
      maxResults: { type: 'number' },
    }),
  },
  {
    name: 'create_event',
    description: 'Create a calendar event.',
    inputSchema: obj(
      {
        summary: { type: 'string' },
        start: { type: 'string' },
        end: { type: 'string' },
        attendees: { type: 'array', items: { type: 'string' } },
        description: { type: 'string' },
      },
      ['summary', 'start', 'end'],
    ),
  },
  {
    name: 'suggest_time',
    description: 'Suggest the next open slot of a given duration.',
    inputSchema: obj(
      {
        durationMins: { type: 'number' },
        attendees: { type: 'array', items: { type: 'string' } },
        windowStart: { type: 'string' },
        windowEnd: { type: 'string' },
      },
      ['durationMins'],
    ),
  },
];

/**
 * Exposes Gmail + Calendar as MCP-shaped tools backed by Google REST APIs
 * (Google has no public remote MCP). Uses the member's OAuth bearer token,
 * refreshing it pre-emptively (stored `expiry_date`) or reactively (on a 401)
 * and persisting the new token back to the connection.
 */
@Injectable()
export class GoogleRestAdapter implements ProviderAdapter {
  private readonly logger = new Logger(GoogleRestAdapter.name);

  constructor(
    private readonly vault: TokenVaultService,
    private readonly cfg: ConfigService,
    @InjectModel(UserConnection.name)
    private readonly connModel: Model<UserConnectionDocument>,
  ) {}

  listTools(conn: ConnectionLike): Promise<McpTool[]> {
    if (conn.provider === 'gmail') return Promise.resolve(GMAIL_TOOLS);
    if (conn.provider === 'calendar') return Promise.resolve(CALENDAR_TOOLS);
    return Promise.resolve([]);
  }

  async callTool(
    conn: ConnectionLike,
    tool: string,
    input: Record<string, unknown>,
  ): Promise<string> {
    if (conn.provider === 'gmail') return this.gmail(conn, tool, input);
    if (conn.provider === 'calendar') return this.calendar(conn, tool, input);
    return `Tool error: unsupported provider ${conn.provider}`;
  }

  // ── Gmail ─────────────────────────────────────────────────────────────────
  private async gmail(
    conn: ConnectionLike,
    tool: string,
    input: Record<string, unknown>,
  ): Promise<string> {
    if (tool === 'send_email' || tool === 'create_draft') {
      const raw = this.buildRfc822(
        String(input.to ?? ''),
        String(input.subject ?? ''),
        String(input.body ?? ''),
      );
      if (tool === 'send_email') {
        const res = await this.authedJson(conn, `${GMAIL_BASE}/messages/send`, {
          method: 'POST',
          body: { raw },
        });
        if (!res.ok) return this.fail('send_email', res);
        return `Email sent to ${String(input.to)}`;
      }
      const res = await this.authedJson(conn, `${GMAIL_BASE}/drafts`, {
        method: 'POST',
        body: { message: { raw } },
      });
      if (!res.ok) return this.fail('create_draft', res);
      const data = (await res.json()) as { id?: string };
      return `Draft created: ${data.id ?? '(unknown id)'}`;
    }

    if (tool === 'search_threads') {
      const params = new URLSearchParams({ q: String(input.query ?? '') });
      if (input.maxResults) params.set('maxResults', String(input.maxResults));
      const res = await this.authedJson(
        conn,
        `${GMAIL_BASE}/threads?${params.toString()}`,
        { method: 'GET' },
      );
      if (!res.ok) return this.fail('search_threads', res);
      const data = (await res.json()) as { threads?: unknown[] };
      return `Found ${data.threads?.length ?? 0} thread(s).`;
    }

    return `Tool error: unknown gmail tool ${tool}`;
  }

  // ── Calendar ──────────────────────────────────────────────────────────────
  private async calendar(
    conn: ConnectionLike,
    tool: string,
    input: Record<string, unknown>,
  ): Promise<string> {
    if (tool === 'create_event') {
      const body: Record<string, unknown> = {
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.start },
        end: { dateTime: input.end },
      };
      if (Array.isArray(input.attendees)) {
        body.attendees = (input.attendees as string[]).map((email) => ({ email }));
      }
      const res = await this.authedJson(conn, `${CAL_BASE}/events`, {
        method: 'POST',
        body,
      });
      if (!res.ok) return this.fail('create_event', res);
      return `Event "${String(input.summary)}" booked at ${String(input.start)}`;
    }

    if (tool === 'list_events' || tool === 'suggest_time') {
      const params = new URLSearchParams({
        singleEvents: 'true',
        orderBy: 'startTime',
      });
      const timeMin = (input.timeMin as string) ?? (input.windowStart as string);
      const timeMax = (input.timeMax as string) ?? (input.windowEnd as string);
      if (timeMin) params.set('timeMin', timeMin);
      else params.set('timeMin', new Date().toISOString());
      if (timeMax) params.set('timeMax', timeMax);
      if (input.maxResults) params.set('maxResults', String(input.maxResults));

      const res = await this.authedJson(
        conn,
        `${CAL_BASE}/events?${params.toString()}`,
        { method: 'GET' },
      );
      if (!res.ok) return this.fail(tool, res);
      const data = (await res.json()) as {
        items?: Array<{ start?: { dateTime?: string }; end?: { dateTime?: string } }>;
      };
      const events = data.items ?? [];
      if (tool === 'list_events') {
        return `${events.length} upcoming event(s).`;
      }
      return this.firstOpenSlot(events, Number(input.durationMins ?? 30), timeMin);
    }

    return `Tool error: unknown calendar tool ${tool}`;
  }

  /** Naive open-slot finder: first gap >= durationMins after windowStart/now. */
  private firstOpenSlot(
    events: Array<{ start?: { dateTime?: string }; end?: { dateTime?: string } }>,
    durationMins: number,
    windowStart?: string,
  ): string {
    const durMs = durationMins * 60_000;
    let cursor = windowStart ? new Date(windowStart).getTime() : Date.now();
    const busy = events
      .map((e) => ({
        start: e.start?.dateTime ? new Date(e.start.dateTime).getTime() : 0,
        end: e.end?.dateTime ? new Date(e.end.dateTime).getTime() : 0,
      }))
      .filter((b) => b.end > 0)
      .sort((a, b) => a.start - b.start);
    for (const b of busy) {
      if (b.start - cursor >= durMs) break;
      if (b.end > cursor) cursor = b.end;
    }
    return `Next open ${durationMins}-min slot: ${new Date(cursor).toISOString()}`;
  }

  // ── HTTP + token plumbing ───────────────────────────────────────────────────
  private async authedJson(
    conn: ConnectionLike,
    url: string,
    opts: { method: string; body?: unknown },
  ): Promise<Response> {
    const build = (token: string): RequestInit => ({
      method: opts.method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
    });

    let token = await this.validToken(conn);
    let res = await fetch(url, build(token));
    if (res.status === 401) {
      const refreshed = await this.tryRefresh(conn);
      if (refreshed) {
        token = refreshed;
        res = await fetch(url, build(token));
      }
    }
    return res;
  }

  private decode(conn: ConnectionLike): GoogleTokens {
    return JSON.parse(this.vault.decrypt(conn.encryptedTokens!)) as GoogleTokens;
  }

  /** Current access token, pre-emptively refreshed if within 60s of expiry. */
  private async validToken(conn: ConnectionLike): Promise<string> {
    const tokens = this.decode(conn);
    if (
      tokens.expiry_date &&
      tokens.expiry_date < Date.now() + 60_000 &&
      tokens.refresh_token
    ) {
      return (await this.tryRefresh(conn)) ?? tokens.access_token;
    }
    return tokens.access_token;
  }

  /** Exchange the refresh_token for a new access token; persist + return it. */
  private async tryRefresh(conn: ConnectionLike): Promise<string | null> {
    const tokens = this.decode(conn);
    if (!tokens.refresh_token) return null;
    const google = this.cfg.get<{ clientId: string; clientSecret: string }>('google');
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
      client_id: google?.clientId ?? '',
      client_secret: google?.clientSecret ?? '',
    });
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) {
      this.logger.warn(`Google token refresh failed (${res.status})`);
      return null;
    }
    const data = (await res.json()) as { access_token: string; expires_in?: number };
    const merged: GoogleTokens = {
      ...tokens,
      access_token: data.access_token,
      expiry_date: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    if (conn._id) {
      await this.connModel.updateOne(
        { _id: conn._id },
        { $set: { encryptedTokens: this.vault.encrypt(JSON.stringify(merged)) } },
      );
    }
    return merged.access_token;
  }

  private buildRfc822(to: string, subject: string, body: string): string {
    const message = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      body,
    ].join('\r\n');
    return Buffer.from(message).toString('base64url');
  }

  private async fail(tool: string, res: Response): Promise<string> {
    const text = await res.text().catch(() => '');
    return `Tool error: ${tool} failed (${res.status}) ${text.slice(0, 120)}`;
  }
}
