import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SingleFlight } from '../common/single-flight';
import { connectionExpired, httpFailure, ToolExecutionError } from '../internal/tool-errors';
import { McpTool } from '../mcp/mcp-client.service';
import { parseOAuthErrorCode } from '../oauth/oauth-errors';
import { TokenVaultService } from '../vault/token-vault.service';
import {
  UserConnection,
  UserConnectionDocument,
} from '../connections/schemas/user-connection.schema';
import {
  googleErrorReason,
  summarizeEvents,
  summarizeThreads,
  threadSummary,
  CalendarEventLike,
} from './google-format';
import { buildMimeMessage, MimeInputError } from './google-mime';
import { CALENDAR_TOOLS, GMAIL_TOOLS } from './google-tools';
import { ConnectionLike, ProviderAdapter, RevokeOutcome } from './provider-adapter.interface';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
const CAL_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary';
/** Gmail and Calendar are both granted to the same Google OAuth client. */
const GOOGLE_PROVIDERS = ['gmail', 'calendar'];
const REQUEST_TIMEOUT_MS = 8_000;
const REFRESH_SKEW_MS = 60_000;
const MAX_THREADS = 10;
const MAX_EVENTS = 25;

interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  [k: string]: unknown;
}

const SERVICE_NAME: Record<string, string> = { gmail: 'Gmail', calendar: 'Google Calendar' };

function clampInt(value: unknown, fallback: number, max: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

/**
 * Exposes Gmail + Calendar as MCP-shaped tools backed by Google REST APIs
 * (Google has no public remote MCP). Uses the member's OAuth bearer token,
 * refreshing it pre-emptively (stored `expiry_date`) or reactively (on a 401) —
 * single-flight per connection, from the stored tokens — and persisting the
 * result. A dead refresh token (`invalid_grant`) marks the connection
 * `expired` and yields CONNECTION_EXPIRED instead of raw Google JSON.
 */
@Injectable()
export class GoogleRestAdapter implements ProviderAdapter {
  private readonly logger = new Logger(GoogleRestAdapter.name);
  private readonly refreshes = new SingleFlight<string | null>();

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

  async callTool(conn: ConnectionLike, tool: string, input: Record<string, unknown>): Promise<string> {
    try {
      if (conn.provider === 'gmail') return await this.gmail(conn, tool, input ?? {});
      if (conn.provider === 'calendar') return await this.calendar(conn, tool, input ?? {});
    } catch (err) {
      if (err instanceof MimeInputError) throw new ToolExecutionError('INVALID_INPUT', err.message);
      throw err;
    }
    throw new ToolExecutionError('UNKNOWN_TOOL', `Unsupported provider ${conn.provider}.`);
  }

  // ── Gmail ─────────────────────────────────────────────────────────────────
  private async gmail(conn: ConnectionLike, tool: string, input: Record<string, unknown>): Promise<string> {
    if (tool === 'send_email' || tool === 'create_draft') {
      const raw = buildMimeMessage({
        to: String(input.to ?? ''),
        subject: String(input.subject ?? ''),
        body: String(input.body ?? ''),
      });
      if (tool === 'send_email') {
        const res = await this.authedJson(conn, `${GMAIL_BASE}/messages/send`, { method: 'POST', body: { raw } });
        if (!res.ok) throw await this.failure(conn, res);
        const sent = (await res.json().catch(() => ({}))) as { id?: string };
        return `Email sent to ${String(input.to)}${sent.id ? ` (message id: ${sent.id})` : ''}.`;
      }
      const res = await this.authedJson(conn, `${GMAIL_BASE}/drafts`, { method: 'POST', body: { message: { raw } } });
      if (!res.ok) throw await this.failure(conn, res);
      const data = (await res.json().catch(() => ({}))) as { id?: string };
      return `Draft created${data.id ? ` (draft id: ${data.id})` : ''}.`;
    }
    if (tool === 'search_threads') return this.searchThreads(conn, input);
    throw new ToolExecutionError('UNKNOWN_TOOL', `Unknown Gmail tool ${tool}.`);
  }

  private async searchThreads(conn: ConnectionLike, input: Record<string, unknown>): Promise<string> {
    const query = String(input.query ?? '');
    const limit = clampInt(input.maxResults, MAX_THREADS, MAX_THREADS);
    const params = new URLSearchParams({ q: query, maxResults: String(limit) });
    const res = await this.authedJson(conn, `${GMAIL_BASE}/threads?${params.toString()}`, { method: 'GET' });
    if (!res.ok) throw await this.failure(conn, res);
    const data = (await res.json()) as {
      threads?: Array<{ id?: string; snippet?: string }>;
      resultSizeEstimate?: number;
    };
    const listed = (data.threads ?? []).filter((t) => t.id).slice(0, limit);
    const meta = new URLSearchParams({ format: 'metadata' });
    for (const h of ['From', 'Subject', 'Date']) meta.append('metadataHeaders', h);
    const details = await Promise.all(
      listed.map(async (t) => {
        const r = await this.authedJson(conn, `${GMAIL_BASE}/threads/${encodeURIComponent(t.id!)}?${meta}`, {
          method: 'GET',
        });
        if (!r.ok) return { id: t.id!, messageCount: 1, snippet: t.snippet };
        return threadSummary(await r.json());
      }),
    );
    return summarizeThreads(query, details, data.resultSizeEstimate);
  }

  // ── Calendar ──────────────────────────────────────────────────────────────
  private async calendar(conn: ConnectionLike, tool: string, input: Record<string, unknown>): Promise<string> {
    if (tool === 'create_event') {
      const body: Record<string, unknown> = {
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.start },
        end: { dateTime: input.end },
      };
      if (Array.isArray(input.attendees)) {
        body.attendees = (input.attendees as unknown[]).map((email) => ({ email: String(email) }));
      }
      const res = await this.authedJson(conn, `${CAL_BASE}/events`, { method: 'POST', body });
      if (!res.ok) throw await this.failure(conn, res);
      const created = (await res.json().catch(() => ({}))) as { id?: string };
      return `Event "${String(input.summary)}" booked at ${String(input.start)}${created.id ? ` (event id: ${created.id})` : ''}.`;
    }

    if (tool === 'list_events' || tool === 'suggest_time') {
      const params = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime' });
      const timeMin = (input.timeMin as string) ?? (input.windowStart as string);
      const timeMax = (input.timeMax as string) ?? (input.windowEnd as string);
      params.set('timeMin', timeMin ? String(timeMin) : new Date().toISOString());
      if (timeMax) params.set('timeMax', String(timeMax));
      params.set('maxResults', String(clampInt(input.maxResults, tool === 'list_events' ? 10 : MAX_EVENTS, MAX_EVENTS)));
      const res = await this.authedJson(conn, `${CAL_BASE}/events?${params.toString()}`, { method: 'GET' });
      if (!res.ok) throw await this.failure(conn, res);
      const events = ((await res.json()) as { items?: CalendarEventLike[] }).items ?? [];
      if (tool === 'list_events') return summarizeEvents(events);
      return this.firstOpenSlot(events, Number(input.durationMins ?? 30), timeMin);
    }

    throw new ToolExecutionError('UNKNOWN_TOOL', `Unknown calendar tool ${tool}.`);
  }

  /** Naive open-slot finder: first gap >= durationMins after windowStart/now. */
  private firstOpenSlot(events: CalendarEventLike[], durationMins: number, windowStart?: string): string {
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

  // ── Revocation ───────────────────────────────────────────────────────────

  /**
   * Revoke the grant at Google before the connection is deleted. Skipped while
   * the member still has the sibling Google connection (Gmail ↔ Calendar):
   * both use the same OAuth client, and revoking one token revokes the whole
   * grant — disconnecting Gmail would silently break Calendar.
   */
  async revoke(conn: ConnectionLike): Promise<RevokeOutcome> {
    try {
      if (conn.userId) {
        const sibling = await this.connModel.exists({
          userId: conn.userId,
          provider: { $in: GOOGLE_PROVIDERS.filter((p) => p !== conn.provider) },
          status: 'active',
        });
        if (sibling) return 'skipped';
      }
      const tokens = this.decode(conn.encryptedTokens);
      const token = tokens.refresh_token ?? tokens.access_token;
      if (!token) return 'skipped';
      const res = await fetch(GOOGLE_REVOKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }).toString(),
        signal: AbortSignal.timeout(5_000),
      });
      return res.ok ? 'revoked' : 'failed';
    } catch (err) {
      this.logger.warn(`Google revoke failed for ${conn.provider}: ${(err as Error).message}`);
      return 'failed';
    }
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
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const token = await this.validToken(conn);
    const res = await fetch(url, build(token));
    if (res.status !== 401) return res;
    const refreshed = await this.refresh(conn, token);
    if (!refreshed || refreshed === token) return res;
    return fetch(url, build(refreshed));
  }

  private decode(blob: ConnectionLike['encryptedTokens']): GoogleTokens {
    return JSON.parse(this.vault.decrypt(blob!)) as GoogleTokens;
  }

  private static expiringSoon(tokens: GoogleTokens): boolean {
    return !!tokens.expiry_date && tokens.expiry_date < Date.now() + REFRESH_SKEW_MS;
  }

  /** Current access token, pre-emptively refreshed if within 60s of expiry. */
  private async validToken(conn: ConnectionLike): Promise<string> {
    const tokens = this.decode(conn.encryptedTokens);
    if (GoogleRestAdapter.expiringSoon(tokens) && tokens.refresh_token) {
      return (await this.refresh(conn)) ?? tokens.access_token;
    }
    return tokens.access_token;
  }

  private refresh(conn: ConnectionLike, rejectedToken?: string): Promise<string | null> {
    return this.refreshes.run(String(conn._id ?? conn.provider), () => this.refreshLatest(conn, rejectedToken));
  }

  /** Refresh from the STORED tokens (another request may already have done it). */
  private async refreshLatest(conn: ConnectionLike, rejectedToken?: string): Promise<string | null> {
    let tokens = this.decode(conn.encryptedTokens);
    if (conn._id) {
      const latest = await this.connModel
        .findById(conn._id, { encryptedTokens: 1, status: 1 })
        .lean<{ encryptedTokens?: ConnectionLike['encryptedTokens']; status?: string }>();
      if (latest?.status && latest.status !== 'active') throw connectionExpired(conn.provider);
      if (latest?.encryptedTokens) tokens = this.decode(latest.encryptedTokens);
    }
    const alreadyFresh =
      rejectedToken === undefined ? !GoogleRestAdapter.expiringSoon(tokens) : tokens.access_token !== rejectedToken;
    if (alreadyFresh) return tokens.access_token;
    if (!tokens.refresh_token) return null;

    const google = this.cfg.get<{ clientId: string; clientSecret: string }>('google');
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
        client_id: google?.clientId ?? '',
        client_secret: google?.clientSecret ?? '',
      }).toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      const oauthError = parseOAuthErrorCode(await res.text().catch(() => ''));
      if (oauthError === 'invalid_grant') {
        await this.markExpired(conn);
        throw connectionExpired(conn.provider);
      }
      this.logger.warn(`Google token refresh failed (${res.status}${oauthError ? ` ${oauthError}` : ''})`);
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

  private async markExpired(conn: ConnectionLike): Promise<void> {
    if (!conn._id) return;
    try {
      await this.connModel.updateOne({ _id: conn._id }, { $set: { status: 'expired' } });
      this.logger.warn(`Marked ${conn.provider} connection ${String(conn._id)} expired (invalid_grant)`);
    } catch (err) {
      this.logger.warn(`Could not mark ${conn.provider} expired: ${(err as Error).message}`);
    }
  }

  /** Map a failed Google response to a clean tool error; the body is only logged. */
  private async failure(conn: ConnectionLike, res: Response): Promise<ToolExecutionError> {
    const text = await res.text().catch(() => '');
    this.logger.warn(`${conn.provider} API ${res.status}: ${text.slice(0, 300)}`);
    return httpFailure(SERVICE_NAME[conn.provider] ?? conn.provider, res.status, googleErrorReason(text));
  }
}
