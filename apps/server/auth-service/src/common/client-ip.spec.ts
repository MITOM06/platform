import express from 'express';
import request from 'supertest';
import {
  applyTrustProxy,
  clientIpHeaderName,
  parseTrustProxy,
  resolveClientIp,
} from './client-ip';

describe('resolveClientIp', () => {
  it('uses the configured header (first value) when present', () => {
    const req = {
      headers: { 'cf-connecting-ip': '203.0.113.7' },
      ip: '172.18.0.5',
    };
    expect(resolveClientIp(req, 'cf-connecting-ip')).toBe('203.0.113.7');

    const multi = {
      headers: { 'cf-connecting-ip': '203.0.113.7, 10.0.0.1' },
      ip: '172.18.0.5',
    };
    expect(resolveClientIp(multi, 'cf-connecting-ip')).toBe('203.0.113.7');

    const arr = {
      headers: { 'cf-connecting-ip': ['2001:db8::1'] },
      ip: '172.18.0.5',
    };
    expect(resolveClientIp(arr, 'cf-connecting-ip')).toBe('2001:db8::1');
  });

  it('falls back to req.ip when the header is absent, blank or not an IP', () => {
    expect(
      resolveClientIp({ headers: {}, ip: '172.18.0.5' }, 'cf-connecting-ip'),
    ).toBe('172.18.0.5');
    expect(
      resolveClientIp(
        { headers: { 'cf-connecting-ip': ' ' }, ip: '172.18.0.5' },
        'cf-connecting-ip',
      ),
    ).toBe('172.18.0.5');
    // Garbage must not become its own bucket (one per request = no limit at all).
    expect(
      resolveClientIp(
        { headers: { 'cf-connecting-ip': 'not-an-ip' }, ip: '172.18.0.5' },
        'cf-connecting-ip',
      ),
    ).toBe('172.18.0.5');
  });

  it('ignores the header entirely when CLIENT_IP_HEADER is not configured', () => {
    const req = {
      headers: { 'cf-connecting-ip': '203.0.113.7' },
      ip: '172.18.0.5',
    };
    expect(resolveClientIp(req, undefined)).toBe('172.18.0.5');
  });

  it('falls back to the socket address, then a constant', () => {
    expect(
      resolveClientIp({ socket: { remoteAddress: '10.1.1.1' } }, undefined),
    ).toBe('10.1.1.1');
    expect(resolveClientIp({}, undefined)).toBe('unknown');
  });

  it('clientIpHeaderName lower-cases and treats blank as unset', () => {
    expect(clientIpHeaderName('CF-Connecting-IP')).toBe('cf-connecting-ip');
    expect(clientIpHeaderName('  ')).toBeUndefined();
    expect(clientIpHeaderName(undefined)).toBeUndefined();
  });
});

describe('parseTrustProxy / applyTrustProxy', () => {
  it('parses hop counts, booleans and Express preset strings; blank = untouched', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy(' 2 ')).toBe(2);
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('loopback, uniquelocal')).toBe(
      'loopback, uniquelocal',
    );
    expect(parseTrustProxy('')).toBeUndefined();
    expect(parseTrustProxy(undefined)).toBeUndefined();
  });

  it('only calls app.set when TRUST_PROXY is configured', () => {
    const app = { set: jest.fn() };
    expect(applyTrustProxy(app, undefined)).toBeUndefined();
    expect(app.set).not.toHaveBeenCalled();
    applyTrustProxy(app, '1');
    expect(app.set).toHaveBeenCalledWith('trust proxy', 1);
  });

  function appWith(trustProxy: string | undefined) {
    const app = express();
    applyTrustProxy(app, trustProxy);
    app.get('/ip', (req, res) => {
      res.json({ ip: resolveClientIp(req, undefined) });
    });
    return app;
  }

  it('without TRUST_PROXY a spoofed X-Forwarded-For is ignored (socket peer wins)', async () => {
    const res = await request(appWith(undefined))
      .get('/ip')
      .set('X-Forwarded-For', '198.51.100.23');
    expect(res.body.ip).not.toBe('198.51.100.23');
    expect(res.body.ip).toMatch(/127\.0\.0\.1|::1/);
  });

  it('with TRUST_PROXY=1 the address appended by the one trusted proxy is used', async () => {
    // The proxy (Caddy) appends the real peer; anything the client pre-filled is further left.
    const res = await request(appWith('1'))
      .get('/ip')
      .set('X-Forwarded-For', '6.6.6.6, 198.51.100.23');
    expect(res.body.ip).toBe('198.51.100.23');
  });
});
