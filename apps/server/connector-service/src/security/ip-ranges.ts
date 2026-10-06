/**
 * IP literal parsing + "is this address reachable only inside a private
 * network?" checks for the outbound SSRF guard. Pure and dependency-free so the
 * rules are unit-testable and identical on every Node version we run (prod is
 * node:20-alpine).
 */

type Cidr = [bytes: number[], prefix: number];

export function parseIpv4(input: string): number[] | null {
  const parts = input.split('.');
  if (parts.length !== 4) return null;
  const out: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    out.push(n);
  }
  return out;
}

/** Parse an IPv6 literal (optionally bracketed / zoned / with a dotted-quad tail) to 16 bytes. */
export function parseIpv6(input: string): number[] | null {
  let s = input.split('%')[0];
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);
  if (!s.includes(':')) return null;
  if (s.includes('.')) {
    const idx = s.lastIndexOf(':');
    const v4 = parseIpv4(s.slice(idx + 1));
    if (!v4) return null;
    const hi = ((v4[0] << 8) | v4[1]).toString(16);
    const lo = ((v4[2] << 8) | v4[3]).toString(16);
    s = `${s.slice(0, idx + 1)}${hi}:${lo}`;
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...new Array(halves.length === 2 ? missing : 0).fill('0'), ...tail];
  if (groups.length !== 8) return null;
  const bytes: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
    const n = Number.parseInt(g, 16);
    bytes.push(n >> 8, n & 0xff);
  }
  return bytes;
}

function cidr(text: string): Cidr {
  const [addr, len] = text.split('/');
  const bytes = parseIpv4(addr) ?? parseIpv6(addr);
  if (!bytes) throw new Error(`bad CIDR ${text}`);
  return [bytes, Number(len)];
}

function inCidr(bytes: number[], [base, prefix]: Cidr): boolean {
  if (bytes.length !== base.length) return false;
  for (let i = 0; i < prefix; i++) {
    const byte = i >> 3;
    const bit = 7 - (i & 7);
    if (((bytes[byte] >> bit) & 1) !== ((base[byte] >> bit) & 1)) return false;
  }
  return true;
}

/** Non-public IPv4 space: RFC 1918, loopback, link-local (incl. 169.254.169.254 metadata), CGNAT, test/benchmark, multicast, reserved. */
const V4_BLOCKED: Cidr[] = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  '192.88.99.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '240.0.0.0/4',
].map(cidr);

/** Non-public IPv6 space: unspecified/loopback/IPv4-compatible, ULA (incl. fd00:ec2::254), link/site-local, multicast, documentation, transition ranges. */
const V6_BLOCKED: Cidr[] = [
  '::/96',
  '64:ff9b:1::/48',
  '100::/64',
  '2001::/23',
  '2001:db8::/32',
  '2002::/16',
  '3fff::/20',
  'fc00::/7',
  'fe80::/10',
  'fec0::/10',
  'ff00::/8',
].map(cidr);

/** IPv6 ranges that embed an IPv4 address in their last 32 bits — judged by that address. */
const V6_EMBEDS_V4: Cidr[] = ['::ffff:0:0/96', '64:ff9b::/96'].map(cidr);

/** True when `ip` is not a publicly routable unicast address. Unparseable input is blocked. */
export function isBlockedIp(ip: string): boolean {
  const v4 = parseIpv4(ip);
  if (v4) return V4_BLOCKED.some((range) => inCidr(v4, range));
  const v6 = parseIpv6(ip);
  if (!v6) return true;
  if (V6_EMBEDS_V4.some((range) => inCidr(v6, range))) {
    const embedded = v6.slice(12);
    return V4_BLOCKED.some((range) => inCidr(embedded, range));
  }
  return V6_BLOCKED.some((range) => inCidr(v6, range));
}

/** True when `host` is an IPv4/IPv6 literal (URL hostnames keep IPv6 brackets). */
export function isIpLiteral(host: string): boolean {
  return parseIpv4(host) !== null || parseIpv6(host) !== null;
}
