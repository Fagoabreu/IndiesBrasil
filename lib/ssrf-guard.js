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

/** Os quatro octetos a partir de `offset` (padrão: fim do endereço). */
function ipv4FromBytes(bytes, offset = 12) {
  return `${bytes[offset]}.${bytes[offset + 1]}.${bytes[offset + 2]}.${bytes[offset + 3]}`;
}

/**
 * Expande um IPv6 (já validado por `net.isIPv6`) nos 16 bytes.
 *
 * Precisa ser feito à mão porque o IPv4 embutido pode vir em **notação
 * decimal** (`::ffff:127.0.0.1`), que nenhum parser hexadecimal aceita
 * diretamente. Devolve `null` quando não consegue interpretar — quem chama
 * trata como privado (fail closed).
 *
 * @param {string} ip
 * @returns {number[]|null}
 */
function ipv6ToBytes(ip) {
  // Zone id (`fe80::1%eth0`) não faz parte do endereço.
  const clean = ip.split("%")[0].toLowerCase();

  // `::ffff:127.0.0.1` → `::ffff:7f00:1`, para a expansão funcionar igual.
  let normalized = clean;
  const dotted = clean.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const [a, b, c, d] = dotted[2].split(".").map(Number);
    normalized = `${dotted[1]}${(((a << 8) | b) >>> 0).toString(16)}:${(((c << 8) | d) >>> 0).toString(16)}`;
  }

  // No máximo um `::` por endereço; `split` gera 1 ou 2 partes.
  const halves = normalized.split("::");
  if (halves.length > 2) return null;

  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;

  // Sem `::` o endereço tem de ter exatamente 8 grupos; com `::`, ao menos um
  // grupo precisa estar faltando (senão `::` não abrevia nada).
  if (missing < 0) return null;
  if (halves.length === 1 && missing !== 0) return null;
  if (halves.length === 2 && missing === 0) return null;

  const groups = [...head, ...Array.from({ length: missing }, () => "0"), ...tail];

  const bytes = [];
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    const value = Number.parseInt(group, 16);
    bytes.push((value >> 8) & 0xff, value & 0xff);
  }

  return bytes.length === 16 ? bytes : null;
}

/**
 * IPv6 privado, loopback, link-local, ou — o caso que importa — **IPv4
 * embutido**.
 *
 * ## O furo que existia aqui
 *
 * A versão anterior só olhava o prefixo textual (`fc`, `fd`, `fe`, `ff`).
 * `::ffff:127.0.0.1` não casa nenhum deles e passava como **público**. Em host
 * dual-stack, conectar nesse endereço alcança o `127.0.0.1` de verdade — ou
 * seja, o guarda liberava justamente o loopback, que é o alvo mais útil de um
 * SSRF (Postgres em 5432, o próprio app em 3000, o Galene em 8000).
 *
 * O mesmo valia para `::ffff:169.254.169.254` (metadados de nuvem),
 * `64:ff9b::a.b.c.d` (NAT64) e `2002:aabb:ccdd::` (6to4), que também carregam
 * um IPv4 no meio.
 *
 * ## Por que a regra virou allowlist
 *
 * Lista de bloqueio para IPv6 é uma corrida perdida: os prefixos de transição
 * (`::ffff:`, `64:ff9b::`, `2002::`, `2001::/32` Teredo) e os reserved ganham
 * casos novos, e esquecer um é liberar o loopback. Agora **só `2000::/3`
 * (unicast global) é considerado público** — todo o resto é bloqueado por
 * omissão, inclusive o que ainda não existe.
 */
function isPrivateIpv6(ip) {
  const bytes = ipv6ToBytes(ip);
  if (!bytes) return true;

  // IPv4 mapeado (`::ffff:a.b.c.d`) e compatível (`::a.b.c.d`, obsoleto).
  const firstTenZero = bytes.slice(0, 10).every((byte) => byte === 0);
  if (firstTenZero && ((bytes[10] === 0xff && bytes[11] === 0xff) || (bytes[10] === 0 && bytes[11] === 0))) {
    return isPrivateIpv4(ipv4FromBytes(bytes));
  }

  // NAT64 com prefixo bem conhecido (RFC 6052): `64:ff9b::/96`.
  if (bytes[0] === 0x00 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b && bytes.slice(4, 12).every((byte) => byte === 0)) {
    return isPrivateIpv4(ipv4FromBytes(bytes));
  }

  // 6to4 (`2002::/16`): o IPv4 do túnel está nos bytes 2..5.
  if (bytes[0] === 0x20 && bytes[1] === 0x02) {
    return isPrivateIpv4(ipv4FromBytes(bytes, 2));
  }

  // Teredo (`2001:0000::/32`) é túnel para IPv4 e não tem uso legítimo aqui.
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00) return true;

  // Documentação (`2001:db8::/32`), que nunca é destino real.
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8) return true;

  // Allowlist: `2000::/3` é o único bloco de unicast global. Fora dele estão
  // `::`, `::1`, `fc00::/7` (unique-local), `fe80::/10` (link-local) e
  // `ff00::/8` (multicast).
  return (bytes[0] & 0xe0) !== 0x20;
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
