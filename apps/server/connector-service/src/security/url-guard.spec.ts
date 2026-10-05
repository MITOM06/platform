import { isBlockedIp, parseIpv6 } from './ip-ranges';
import { assertSafeUrl, checkUrlSyntax, resolver, safeFetch, UnsafeUrlError } from './url-guard';

const PROD = { NODE_ENV: 'production' };
const PUBLIC_IP = [{ address: '93.184.216.34', family: 4 }];

function reasonOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (err) {
    return (err as UnsafeUrlError).reason;
  }
  return undefined;
}

describe('isBlockedIp', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.10',
    '169.254.169.254', // cloud metadata
    '100.64.0.1', // CGNAT
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '::1',
    '::',
    'fd00:ec2::254', // AWS IMDS v6 (ULA)
    'fe80::1',
    'ff02::1',
    '::ffff:127.0.0.1', // IPv4-mapped loopback
    '::ffff:7f00:1', // same, hex form (URL normalisation)
    '::ffff:10.0.0.1',
    '64:ff9b::a00:1', // NAT64 of 10.0.0.1
    '2001:db8::1',
    'not-an-ip',
  ])('blocks %s', (ip) => {
    expect(isBlockedIp(ip)).toBe(true);
  });

  it.each(['93.184.216.34', '8.8.8.8', '1.1.1.1', '2606:4700:4700::1111', '::ffff:8.8.8.8', '172.32.0.1'])(
    'allows public %s',
    (ip) => {
      expect(isBlockedIp(ip)).toBe(false);
    },
  );

  it('parses compressed IPv6 with a dotted-quad tail', () => {
    expect(parseIpv6('::ffff:1.2.3.4')).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff, 1, 2, 3, 4]);
    expect(parseIpv6('1:2:3:4:5:6:7:8:9')).toBeNull();
  });
});

describe('checkUrlSyntax (production)', () => {
  it('accepts a public https URL', () => {
    expect(() => checkUrlSyntax('https://mcp.notion.com/mcp', PROD)).not.toThrow();
  });

  it.each([
    ['http://mcp.example.com/mcp', 'https required'],
    ['https://chat-service:8080/api', 'single-label host'],
    ['https://qdrant:6333', 'single-label host'],
    ['https://localhost/mcp', 'single-label host'],
    ['https://metadata.google.internal/computeMetadata', 'internal hostname'],
    ['https://host.docker.internal/mcp', 'internal hostname'],
    ['https://printer.local/', 'internal hostname'],
    ['https://127.0.0.1/mcp', 'private address'],
    ['https://2130706433/', 'private address'], // decimal 127.0.0.1
    ['https://0x7f.1/', 'private address'],
    ['https://[::1]/mcp', 'private address'],
    ['https://[::ffff:127.0.0.1]/', 'private address'],
    ['https://169.254.169.254/latest/meta-data', 'private address'],
    ['https://user:pass@mcp.example.com/', 'credentials in URL'],
    ['not a url', 'malformed URL'],
  ])('rejects %s (%s)', (url, reason) => {
    expect(reasonOf(() => checkUrlSyntax(url, PROD))).toBe(reason);
  });

  it('ignores CONNECTOR_DEV_ALLOW_HOSTS in production', () => {
    const env = { ...PROD, CONNECTOR_DEV_ALLOW_HOSTS: 'localhost' };
    expect(reasonOf(() => checkUrlSyntax('http://localhost:9000/mcp', env))).toBe('https required');
  });
});

describe('checkUrlSyntax (development)', () => {
  it('allows http only for explicitly allow-listed hosts', () => {
    const env = { NODE_ENV: 'development', CONNECTOR_DEV_ALLOW_HOSTS: 'localhost, mock-mcp' };
    expect(checkUrlSyntax('http://localhost:9000/mcp', env).devAllowed).toBe(true);
    expect(checkUrlSyntax('http://mock-mcp/mcp', env).devAllowed).toBe(true);
    expect(reasonOf(() => checkUrlSyntax('http://chat-service:8080', env))).toBe('https required');
    expect(reasonOf(() => checkUrlSyntax('https://chat-service:8080', env))).toBe('single-label host');
  });
});

describe('assertSafeUrl (DNS)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('passes when every DNS answer is public', async () => {
    jest.spyOn(resolver, 'lookup').mockResolvedValue(PUBLIC_IP);
    await expect(assertSafeUrl('https://mcp.example.com/mcp', PROD)).resolves.toBeInstanceOf(URL);
  });

  it('rejects a public name that resolves to a private address', async () => {
    jest.spyOn(resolver, 'lookup').mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.5', family: 4 },
    ]);
    await expect(assertSafeUrl('https://rebind.example.com/', PROD)).rejects.toMatchObject({
      reason: 'private address',
    });
  });

  it('rejects an unresolvable host', async () => {
    jest.spyOn(resolver, 'lookup').mockRejectedValue(new Error('ENOTFOUND'));
    await expect(assertSafeUrl('https://nope.example.com/', PROD)).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it('is a 400 with a code and never echoes the URL', async () => {
    const err = await assertSafeUrl('https://user:sk-secret@x.example.com/', PROD).catch((e) => e);
    expect(err.getStatus()).toBe(400);
    expect(err.getResponse()).toEqual({ code: 'UNSAFE_URL', reason: 'credentials in URL' });
    expect(JSON.stringify(err.getResponse())).not.toContain('sk-secret');
  });
});

describe('safeFetch', () => {
  let fetchMock: jest.Mock;
  const prevEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    jest.spyOn(resolver, 'lookup').mockImplementation(async (host: string) =>
      host === 'internal.example.com' ? [{ address: '10.0.0.7', family: 4 }] : PUBLIC_IP,
    );
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env.NODE_ENV = prevEnv;
    jest.restoreAllMocks();
  });

  const redirect = (status: number, location: string) =>
    ({ status, headers: new Headers({ location }), body: null }) as unknown as Response;

  it('re-checks every redirect hop and refuses an internal target', async () => {
    fetchMock.mockResolvedValueOnce(redirect(302, 'https://internal.example.com/admin'));
    await expect(safeFetch('https://mcp.example.com/token', { method: 'POST', body: 'x' })).rejects.toMatchObject({
      reason: 'private address',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].redirect).toBe('manual');
  });

  it('drops credentials on a cross-origin redirect and turns 303 into a body-less GET', async () => {
    fetchMock
      .mockResolvedValueOnce(redirect(303, 'https://other.example.com/done'))
      .mockResolvedValueOnce({ status: 200, ok: true, headers: new Headers() } as unknown as Response);
    await safeFetch('https://mcp.example.com/token', {
      method: 'POST',
      body: 'grant_type=x',
      headers: { Authorization: 'Bearer secret', 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('https://other.example.com/done');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect((init.headers as Headers).get('authorization')).toBeNull();
  });

  it('keeps method, body and credentials on a same-origin 307', async () => {
    fetchMock
      .mockResolvedValueOnce(redirect(307, '/v2/token'))
      .mockResolvedValueOnce({ status: 200, ok: true, headers: new Headers() } as unknown as Response);
    await safeFetch('https://mcp.example.com/token', {
      method: 'POST',
      body: 'a=1',
      headers: { Authorization: 'Bearer t' },
    });
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('https://mcp.example.com/v2/token');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('a=1');
    expect((init.headers as Headers).get('authorization')).toBe('Bearer t');
  });

  it('never sends the first request to a blocked URL', async () => {
    await expect(safeFetch('http://chat-service:8080/internal')).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
