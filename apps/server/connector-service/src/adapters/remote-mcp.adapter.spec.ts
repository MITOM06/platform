import { Logger } from '@nestjs/common';
import { RemoteMcpAdapter } from './remote-mcp.adapter';
import { TokenEndpointError } from '../oauth/oauth-errors';
import { ToolExecutionError } from '../internal/tool-errors';
import { ConnectionLike } from './provider-adapter.interface';

/** Transparent fake vault: a "blob" is `{ plain }`. */
const vault = {
  encrypt: jest.fn((plain: string) => ({ plain })),
  decrypt: jest.fn((b: { plain: string }) => b.plain),
};
const blob = (v: unknown) => ({ plain: typeof v === 'string' ? v : JSON.stringify(v) }) as any;

/** An HTTP error the way the MCP transport surfaces it (`code` = status). */
const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { code: status });

const LATER = () => Date.now() + 3_600_000;
const SOON = () => Date.now() + 10_000;

describe('RemoteMcpAdapter', () => {
  let mcp: { listTools: jest.Mock; callTool: jest.Mock; evictConnection: jest.Mock };
  let mcpOAuth: { refresh: jest.Mock };
  let connModel: { findById: jest.Mock; updateOne: jest.Mock };
  let stored: { encryptedTokens?: unknown; status?: string } | null;
  let adapter: RemoteMcpAdapter;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    mcp = { listTools: jest.fn(), callTool: jest.fn(), evictConnection: jest.fn().mockResolvedValue(undefined) };
    mcpOAuth = { refresh: jest.fn() };
    stored = null;
    connModel = {
      findById: jest.fn(() => ({ lean: () => Promise.resolve(stored) })),
      updateOne: jest.fn().mockResolvedValue({}),
    };
    vault.encrypt.mockClear();
    vault.decrypt.mockClear();
    adapter = new RemoteMcpAdapter(mcp as any, vault as any, mcpOAuth as any, connModel as any);
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  /** Directory connection with refreshable OAuth tokens. */
  function directoryConn(tokens: Record<string, unknown>, extra: Partial<ConnectionLike> = {}): ConnectionLike {
    return {
      _id: 'c1',
      provider: 'stripe',
      mcpUrl: 'https://mcp.stripe.test/mcp',
      encryptedTokens: blob(tokens),
      tokenEndpoint: 'https://auth.stripe.test/token',
      encryptedClientCreds: blob({ client_id: 'cid', client_secret: 'csecret' }),
      ...extra,
    };
  }

  describe('custom MCP servers (static credential)', () => {
    it('apikey → decrypted credential sent as apikey auth to conn.url, keyed by _id', async () => {
      mcp.callTool.mockResolvedValue('ok');
      const conn: ConnectionLike = {
        _id: 'srv1',
        provider: 'custom_abc',
        url: 'https://my.mcp/x',
        authType: 'apikey',
        encryptedCredential: blob('sk-123'),
      };
      await expect(adapter.callTool(conn, 'search', { q: 1 })).resolves.toBe('ok');
      expect(mcp.callTool).toHaveBeenCalledWith(
        'https://my.mcp/x',
        { type: 'apikey', token: 'sk-123' },
        'search',
        { q: 1 },
        { connKey: 'srv1' },
      );
    });

    it('oauth2 → bearer; no authType → none; key falls back to provider without _id', async () => {
      mcp.listTools.mockResolvedValue([]);
      await adapter.listTools({ provider: 'custom_a', url: 'u', authType: 'oauth2', encryptedCredential: blob('tok') });
      expect(mcp.listTools).toHaveBeenLastCalledWith('u', { type: 'bearer', token: 'tok' }, { connKey: 'custom_a' });
      await adapter.listTools({ provider: 'custom_b' });
      expect(mcp.listTools).toHaveBeenLastCalledWith('', { type: 'none' }, { connKey: 'custom_b' });
    });

    it('a 401 is rethrown untouched (no refresh possible), op not retried', async () => {
      const err = httpError(401);
      mcp.callTool.mockRejectedValue(err);
      const conn: ConnectionLike = { _id: 's', provider: 'custom_a', url: 'u', authType: 'apikey', encryptedCredential: blob('k') };
      await expect(adapter.callTool(conn, 't', {})).rejects.toBe(err);
      expect(mcp.callTool).toHaveBeenCalledTimes(1);
      expect(mcpOAuth.refresh).not.toHaveBeenCalled();
    });
  });

  describe('OAuth bearer connections', () => {
    it('valid token → bearer access_token to mcpUrl, no refresh', async () => {
      mcp.listTools.mockResolvedValue([{ name: 'a' }]);
      const res = await adapter.listTools(directoryConn({ access_token: 'AT', refresh_token: 'RT', expiry_date: LATER() }));
      expect(res).toEqual([{ name: 'a' }]);
      expect(mcp.listTools).toHaveBeenCalledWith('https://mcp.stripe.test/mcp', { type: 'bearer', token: 'AT' }, { connKey: 'c1' });
      expect(mcpOAuth.refresh).not.toHaveBeenCalled();
    });

    it('token without expiry_date is never pre-emptively refreshed', async () => {
      mcp.listTools.mockResolvedValue([]);
      await adapter.listTools(directoryConn({ access_token: 'AT', refresh_token: 'RT' }));
      expect(mcpOAuth.refresh).not.toHaveBeenCalled();
    });

    it('expiring within 60s → pre-emptive refresh, persists merged tokens (keeps unrotated refresh_token)', async () => {
      const expiry = SOON();
      stored = { status: 'active', encryptedTokens: blob({ access_token: 'AT', refresh_token: 'RT', expiry_date: expiry }) };
      mcpOAuth.refresh.mockResolvedValue({ access_token: 'AT2', expiry_date: LATER() });
      mcp.callTool.mockResolvedValue('done');

      await expect(
        adapter.callTool(directoryConn({ access_token: 'AT', refresh_token: 'RT', expiry_date: expiry }), 't', {}),
      ).resolves.toBe('done');

      expect(mcpOAuth.refresh).toHaveBeenCalledWith({
        tokenEndpoint: 'https://auth.stripe.test/token',
        clientId: 'cid',
        clientSecret: 'csecret',
        refreshToken: 'RT',
        resource: 'https://mcp.stripe.test/mcp',
      });
      const [filter, update] = connModel.updateOne.mock.calls[0];
      expect(filter).toEqual({ _id: 'c1' });
      const saved = JSON.parse(update.$set.encryptedTokens.plain);
      expect(saved).toMatchObject({ access_token: 'AT2', refresh_token: 'RT' });
      expect(mcp.callTool).toHaveBeenCalledWith(expect.any(String), { type: 'bearer', token: 'AT2' }, 't', {}, { connKey: 'c1' });
    });

    it('pre-emptive: stored tokens already rotated by another request → use them, no refresh', async () => {
      stored = { status: 'active', encryptedTokens: blob({ access_token: 'FRESH', refresh_token: 'RT2', expiry_date: LATER() }) };
      mcp.listTools.mockResolvedValue([]);
      await adapter.listTools(directoryConn({ access_token: 'AT', refresh_token: 'RT', expiry_date: SOON() }));
      expect(mcpOAuth.refresh).not.toHaveBeenCalled();
      expect(mcp.listTools).toHaveBeenCalledWith(expect.any(String), { type: 'bearer', token: 'FRESH' }, { connKey: 'c1' });
    });

    it('expiring but no tokenEndpoint (cannot refresh) → uses the current token as is', async () => {
      mcp.listTools.mockResolvedValue([]);
      await adapter.listTools(
        directoryConn({ access_token: 'AT', refresh_token: 'RT', expiry_date: SOON() }, { tokenEndpoint: undefined }),
      );
      expect(mcpOAuth.refresh).not.toHaveBeenCalled();
      expect(mcp.listTools).toHaveBeenCalledWith(expect.any(String), { type: 'bearer', token: 'AT' }, { connKey: 'c1' });
    });

    it('concurrent calls on an expiring token refresh ONCE (single-flight)', async () => {
      const tokens = { access_token: 'AT', refresh_token: 'RT', expiry_date: SOON() };
      stored = { status: 'active', encryptedTokens: blob(tokens) };
      mcpOAuth.refresh.mockResolvedValue({ access_token: 'AT2', refresh_token: 'RT2', expiry_date: LATER() });
      mcp.callTool.mockResolvedValue('ok');
      const conn = directoryConn(tokens);
      await Promise.all([adapter.callTool(conn, 'a', {}), adapter.callTool(conn, 'b', {})]);
      expect(mcpOAuth.refresh).toHaveBeenCalledTimes(1);
      expect(mcp.callTool.mock.calls.map((c) => c[1].token)).toEqual(['AT2', 'AT2']);
    });

    it('401 → reactive refresh then ONE retry with the new token', async () => {
      stored = { status: 'active', encryptedTokens: blob({ access_token: 'AT', refresh_token: 'RT', expiry_date: LATER() }) };
      mcpOAuth.refresh.mockResolvedValue({ access_token: 'AT2', refresh_token: 'RT2' });
      mcp.callTool.mockRejectedValueOnce(httpError(401)).mockResolvedValueOnce('retried');
      await expect(
        adapter.callTool(directoryConn({ access_token: 'AT', refresh_token: 'RT', expiry_date: LATER() }), 't', {}),
      ).resolves.toBe('retried');
      expect(mcp.callTool).toHaveBeenCalledTimes(2);
      expect(mcp.callTool.mock.calls[1][1]).toEqual({ type: 'bearer', token: 'AT2' });
    });

    it('401 when the store already holds a different token → retry with it, no refresh call', async () => {
      stored = { status: 'active', encryptedTokens: blob({ access_token: 'OTHER', refresh_token: 'RT9' }) };
      mcp.listTools.mockRejectedValueOnce(httpError(401)).mockResolvedValueOnce(['x']);
      await expect(adapter.listTools(directoryConn({ access_token: 'AT', refresh_token: 'RT' }))).resolves.toEqual(['x']);
      expect(mcpOAuth.refresh).not.toHaveBeenCalled();
      expect(mcp.listTools.mock.calls[1][1]).toEqual({ type: 'bearer', token: 'OTHER' });
    });

    it('401 and refresh yields the same token → original error rethrown, no retry loop', async () => {
      const err = httpError(401);
      stored = { status: 'active', encryptedTokens: blob({ access_token: 'AT', refresh_token: 'RT' }) };
      mcpOAuth.refresh.mockRejectedValue(new Error('network'));
      mcp.callTool.mockRejectedValue(err);
      await expect(adapter.callTool(directoryConn({ access_token: 'AT', refresh_token: 'RT' }), 't', {})).rejects.toBe(err);
      expect(mcp.callTool).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['HTTP 500', httpError(500)],
      ['HTTP 403', httpError(403)],
      ['MCP protocol error with code 401', Object.assign(new Error('x'), { name: 'McpError', code: 401 })],
      ['timeout without status', new Error('Request timed out')],
    ])('%s → rethrown, no refresh', async (_label, err) => {
      mcp.callTool.mockRejectedValue(err);
      await expect(adapter.callTool(directoryConn({ access_token: 'AT', refresh_token: 'RT' }), 't', {})).rejects.toBe(err);
      expect(mcpOAuth.refresh).not.toHaveBeenCalled();
      expect(mcp.callTool).toHaveBeenCalledTimes(1);
    });

    it('invalid_grant → marks the connection expired and throws CONNECTION_EXPIRED (no token in message)', async () => {
      stored = { status: 'active', encryptedTokens: blob({ access_token: 'AT-secret', refresh_token: 'RT-secret', expiry_date: SOON() }) };
      mcpOAuth.refresh.mockRejectedValue(new TokenEndpointError(400, 'invalid_grant'));
      const err = await adapter
        .listTools(directoryConn({ access_token: 'AT-secret', refresh_token: 'RT-secret', expiry_date: SOON() }))
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ToolExecutionError);
      expect((err as ToolExecutionError).code).toBe('CONNECTION_EXPIRED');
      expect((err as Error).message).not.toMatch(/secret/);
      expect(connModel.updateOne).toHaveBeenCalledWith({ _id: 'c1' }, { $set: { status: 'expired' } });
      expect(mcp.listTools).not.toHaveBeenCalled();
    });

    it('invalid_grant and marking expired fails → still CONNECTION_EXPIRED', async () => {
      stored = { status: 'active', encryptedTokens: blob({ access_token: 'AT', refresh_token: 'RT', expiry_date: SOON() }) };
      mcpOAuth.refresh.mockRejectedValue(new TokenEndpointError(400, 'invalid_grant'));
      connModel.updateOne.mockRejectedValue(new Error('db down'));
      await expect(
        adapter.listTools(directoryConn({ access_token: 'AT', refresh_token: 'RT', expiry_date: SOON() })),
      ).rejects.toMatchObject({ code: 'CONNECTION_EXPIRED' });
      expect(warn).toHaveBeenCalledWith('Could not mark stripe expired: db down');
    });

    it('other refresh failure → falls back to current token and logs without leaking secrets', async () => {
      stored = { status: 'active', encryptedTokens: blob({ access_token: 'AT-secret', refresh_token: 'RT-secret', expiry_date: SOON() }) };
      mcpOAuth.refresh.mockRejectedValue(new TokenEndpointError(503));
      mcp.listTools.mockResolvedValue([]);
      await adapter.listTools(directoryConn({ access_token: 'AT-secret', refresh_token: 'RT-secret', expiry_date: SOON() }));
      expect(mcp.listTools).toHaveBeenCalledWith(expect.any(String), { type: 'bearer', token: 'AT-secret' }, { connKey: 'c1' });
      expect(warn).toHaveBeenCalledTimes(1);
      const logged = String(warn.mock.calls[0][0]);
      expect(logged).toMatch(/^Token refresh failed for stripe: /);
      expect(logged).not.toMatch(/secret|csecret/);
      expect(connModel.updateOne).not.toHaveBeenCalled();
    });

    it('stored connection no longer active → CONNECTION_EXPIRED, nothing refreshed or called', async () => {
      stored = { status: 'expired', encryptedTokens: blob({ access_token: 'AT', refresh_token: 'RT' }) };
      await expect(
        adapter.callTool(directoryConn({ access_token: 'AT', refresh_token: 'RT', expiry_date: SOON() }), 't', {}),
      ).rejects.toMatchObject({ code: 'CONNECTION_EXPIRED' });
      expect(mcpOAuth.refresh).not.toHaveBeenCalled();
      expect(mcp.callTool).not.toHaveBeenCalled();
    });

    it('connection without _id refreshes from its own tokens and does not persist', async () => {
      mcpOAuth.refresh.mockResolvedValue({ access_token: 'AT2' });
      mcp.listTools.mockResolvedValue([]);
      await adapter.listTools(
        directoryConn({ access_token: 'AT', refresh_token: 'RT', expiry_date: SOON() }, { _id: undefined, mcpUrl: undefined }),
      );
      expect(connModel.findById).not.toHaveBeenCalled();
      expect(connModel.updateOne).not.toHaveBeenCalled();
      expect(mcpOAuth.refresh).toHaveBeenCalledWith(expect.objectContaining({ resource: '' }));
      expect(mcp.listTools).toHaveBeenCalledWith('', { type: 'bearer', token: 'AT2' }, { connKey: 'stripe' });
    });
  });

  it('revoke → evicts the cached client by connKey and reports unsupported', async () => {
    await expect(adapter.revoke({ _id: 'c9', provider: 'stripe' })).resolves.toBe('unsupported');
    expect(mcp.evictConnection).toHaveBeenCalledWith('c9');
  });
});
