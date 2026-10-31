import { onAHost } from './auth';

// On a host such as Render every request reaches the portal through other servers (Cloudflare, then Render's own proxy),
// and each one writes the address it received the request from into the X-Forwarded-For header. Unless the portal is told
// which addresses are proxies it sees only the last proxy's address for EVERY visitor, so the log in limit (100 requests
// per 15 minutes) was shared by the whole school, and anyone could use it up for everybody.
//
// The portal is told WHICH addresses are proxies, not how many there are: a visitor's address is the first one, reading
// the header from the right, that is not a proxy. That gives the right answer however many proxies there are, and a made-up
// address written into the header by a visitor is never reached, so it cannot be used to dodge the limit.
//
// Set TRUST_PROXY to override: a number (that many proxies), "false" (trust none), or a comma-separated list of addresses.
// On your own computer there are no proxies, so nothing is trusted unless TRUST_PROXY says so.

// Cloudflare's published ranges, copied from https://www.cloudflare.com/ips on 2026-10-31. If Cloudflare ever adds a range
// the worst that happens is that visitors arriving through it share a limit; the dashboard log line "Visitor address check" shows it.
export const CLOUDFLARE_RANGES = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18', '108.162.192.0/18',
  '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
  '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32',
];

// Render's own proxy talks to the portal over its private network
const PRIVATE_NETWORK = ['loopback', 'linklocal', 'uniquelocal', '100.64.0.0/10'];

export function trustProxySetting(): boolean | number | string[] {
  const chosen = (process.env.TRUST_PROXY || '').trim();
  if (chosen) {
    if (chosen === 'false') return false;
    if (/^\d+$/.test(chosen)) return Number(chosen);
    return chosen.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return onAHost ? [...PRIVATE_NETWORK, ...CLOUDFLARE_RANGES] : false;
}
