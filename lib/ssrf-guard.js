import dns from "node:dns/promises";
import net from "node:net";

/**
 * Guarda contra SSRF (Server-Side Request Forgery).
 *
 * Valida uma URL antes de um fetch() server-side:
 *  - exige scheme http(s)
 *  - resolve o hostname via DNS (system resolver, respeita /etc/hosts)
 *  - bloqueia IPs privados, loopback, link-local (inclui metadata 169.254.169.254)
 *  - opcionalmente aplica uma allowlist de hosts
 *
 * Uso server-only (API routes / models). Não importar em componentes client.
 */

const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

// Pares [início, fim] de intervalos IPv4 não-públicos (RFC1918, loopback,
// link-local/CGNAT e redes de teste/benchmark).
const PRIVATE_IPV4_RANGES = [
  [0x00000000, 0x00ffffff], // 0.0.0.0/8
  [0x0a000000, 0x0affffff], // 10.0.0.0/8
  [0x64400000, 0x647fffff], // 100.64.0.0/10 (CGNAT)
  [0x7f000000, 0x7fffffff], // 127.0.0.0/8 (loopback)
  [0xa9fe0000, 0xa9feffff], // 169.254.0.0/16 (link-local + cloud metadata)
  [0xac100000, 0xac1fffff], // 172.16.0.0/12
  [0xc0000000, 0xc00000ff], // 192.0.0.0/24
  [0xc0000200, 0xc00002ff], // 192.0.2.0/24 (TEST-NET-1)
  [0xc0a80000, 0xc0a8ffff], // 192.168.0.0/16
  [0xc6120000, 0xc613ffff], // 198.18.0.0/15 (benchmark)
  [0xc6336400, 0xc63364ff], // 198.51.100.0/24 (TEST-NET-2)
  [0xcb007100, 0xcb0071ff], // 203.0.113.0/24 (TEST-NET-3)
];

function ipv4ToInt(ip) {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isPrivateIpv4(ip) {
  const value = ipv4ToInt(ip);
  return PRIVATE_IPV4_RANGES.some(([start, end]) => value >= start && value <= end);
}

function isPrivateIpv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  // Endereços fora de 2000::/3 (GUA) não são públicos:
  // fc/fd = unique-local, fe = link-local/site-local, ff = multicast.
  return lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe") || lower.startsWith("ff");
}

/**
 * Verifica se um IP (v4 ou v6) é privado, loopback, link-local,
 * CGNAT ou de documentação/benchmark. Bloqueia por padrão (fail closed).
 * @param {string} ip
 * @returns {boolean}
 */
export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) return isPrivateIpv4(ip);
  if (net.isIPv6(ip)) return isPrivateIpv6(ip);
  return true; // desconhecido → bloqueia
}

/**
 * Resolve os endereços IP de um hostname.
 * Retorna array vazio se não resolver (NXDOMAIN, etc.).
 * @param {string} hostname
 * @returns {Promise<string[]>}
 */
async function resolveAddresses(hostname) {
  const cleaned = hostname.replace(/^\[|\]$/g, "");

  // IP literal (ex: http://127.0.0.1 ou http://[::1])
  if (net.isIP(cleaned)) {
    return [cleaned];
  }

  try {
    const results = await dns.lookup(cleaned, { all: true, verbatim: true });
    return results.map((r) => r.address);
  } catch {
    return [];
  }
}

/**
 * Valida se uma URL é segura para fetch() server-side.
 * @param {string} rawUrl
 * @param {{ allowedHosts?: string[] }} [opts] — allowlist de hosts (subdomínios incluídos).
 * @returns {Promise<boolean>}
 */
export async function isSafeUrl(rawUrl, { allowedHosts } = {}) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) return false;
  if (!parsed.hostname) return false;

  if (Array.isArray(allowedHosts) && allowedHosts.length > 0) {
    const allowed = allowedHosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
    if (!allowed) return false;
  }

  const addresses = await resolveAddresses(parsed.hostname);
  if (addresses.length === 0) return false;
  if (addresses.some((addr) => isPrivateIp(addr))) return false;

  return true;
}

const ssrfGuard = { isSafeUrl, isPrivateIp };
export default ssrfGuard;
