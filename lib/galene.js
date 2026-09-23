import crypto from "node:crypto";
import path from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { ValidationError } from "@/infra/errors";

/**
 * lib/galene.js — Provisionamento de salas Galene (webconference).
 *
 * Responsabilidades:
 *  1. Gravar UM arquivo de grupo por ESTÚDIO (`groups/<slug>.json`) com a
 *     "authKeys" que o Galene usa para validar os JWTs emitidos pela
 *     plataforma, mais `"auto-subgroups": true`. Não há arquivo por reunião:
 *     as salas são subgrupos resolvidos por esse mesmo arquivo.
 *  2. Emitir o JWT HS256 de acesso com o formato aceito pelo Galene 1.2.1
 *     (o token é validado pelo servidor vendorizado em galene/token/jwt.go):
 *       aud  = "<origin>/group/<slug-do-estudio>/"  (escopo do estúdio)
 *       exp/iat = timestamps (segundos)
 *       sub  = nome de usuário exibido na sala
 *       permissions = permissões INTERNAS do Galene
 *       include-subgroups = true (o token cobre as salas do estúdio)
 *  3. Montar a URL de entrada do cliente oficial:
 *       "<origin>/group/<estudio>/<reuniao>/?username=<nome>&token=<jwt>"
 *
 * Modelo de escopo (por que um arquivo por estúdio, e não por reunião):
 *  - o número de arquivos é O(nº de estúdios), não O(nº de reuniões): não
 *    cresce sem limite nem deixa sala órfã quando a reunião termina;
 *  - a sala herda `displayName` e `authKeys` do estúdio;
 *  - criar uma reunião não escreve em disco;
 *  - um token vazado abre as salas de UM estúdio, não do servidor inteiro.
 *  Mecanismo conferido contra a tag 1.2.1 em galene/group/description.go
 *  (`getDescriptionFile` + `auto-subgroups`) e galene/token/jwt.go
 *  (`matchGroup` com `include-subgroups`).
 *
 * Variáveis de ambiente:
 *  GALENE_AUTH_SECRET   chave HS256 (32 bytes, base64url). Obrigatória em
 *                       produção; em desenvolvimento usa um fallback fixo.
 *  GALENE_GROUPS_DIR    diretório dos grupos do Galene (bind-mount). Padrão:
 *                       galene/groups (o mesmo diretório que o compose de dev
 *                       monta); em produção o deploy define /app/groups.
 *  MEET_URL             base do servidor, ex. wss://meet.jogos.social.br.
 *                       O origin da página (https) é derivado daqui.
 *
 * Sem IA: o servidor Galene roda sem MediaPipe/background blur (Dockerfile),
 * e a plataforma apenas provisiona grupo + token (D1/D3).
 */

const DEV_AUTH_SECRET_BASE64URL = "eYjgxtLP_xoU9Q8nhK0NQBIaJ8Ins1uC3jqU_yTifbs";
const DEV_MEET_URL = "ws://localhost:8000";

/** Teto de validade de um token de acesso (evita tokens de longa duração). */
const MAX_TOKEN_TTL_SECONDS = 12 * 60 * 60;

const DEFAULT_DISPLAY_NAME = "Convidado";

const ROOM_ID_PATTERN = /^[a-z0-9_-]{1,64}$/;

/**
 * Escopo das salas: o grupo Galene é provisionado por ESTÚDIO e as salas são
 * subgrupos dele (ver `roomGroupName`). O padrão acompanha o que `lib/slug.js`
 * gera para `organizations` (`generateUniqueSlug(..., 60)`), com folga — e,
 * sendo restrito a `[a-z0-9-]`, não aceita `/` nem `.`, o que torna travessia
 * de caminho impossível ao montar `groups/<slug>.json`.
 */
const STUDIO_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;

/** Permissões internas do Galene concedidas por perfil de participante. */
const GALENE_PERMISSIONS = Object.freeze({
  member: ["present", "message", "caption"],
  guest: ["present", "message"],
});

function isProduction() {
  return process.env.NODE_ENV === "production";
}

/**
 * Retorna a chave HS256 usada para assinar os JWTs e gravar a authKeys.
 *
 * Exigências do Galene 1.2.1 (galene/token/jwt.go):
 *  1. O campo `k` da authKeys é decodificado com base64url SEM padding
 *     (Go: base64.RawURLEncoding — RFC 7518 §6.2.1). Um valor com `=` faz o
 *     servidor falhar com "token is unverifiable: illegal base64 data".
 *  2. Para HS256 o `k` deve decodificar para EXATAMENTE 32 bytes — qualquer
 *     outro comprimento falha com "token is unverifiable: bad length for key".
 * Por isso o valor retornado em `encoded` é sempre re-encodado sem padding
 * (aceitamos entrada com ou sem padding, e com alfabeto padrão +/ ou url-safe),
 * e validamos o comprimento exato do material decodificado.
 * @returns {{ keyBytes: Buffer, encoded: string }}
 */
function getAuthSecret() {
  const configured = process.env.GALENE_AUTH_SECRET || (isProduction() ? "" : DEV_AUTH_SECRET_BASE64URL);

  if (!configured) {
    throw new Error("GALENE_AUTH_SECRET não está configurada em produção.");
  }

  // Tolerância: converte base64 padrão (+ /) para o alfabeto url-safe (- _).
  const urlSafe = configured.replace(/\+/g, "-").replace(/\//g, "_");
  const keyBytes = Buffer.from(urlSafe, "base64url");
  if (keyBytes.length !== 32) {
    throw new Error("GALENE_AUTH_SECRET deve ter exatamente 32 bytes em base64url (HS256 do Galene).");
  }

  // `toString("base64url")` do Node emite SEM padding — formato exigido pelo Galene.
  return { keyBytes, encoded: keyBytes.toString("base64url") };
}

/**
 * Origin público do cliente Galene (ex.: https://meet.jogos.social.br).
 * Derivado de MEET_URL para manter um único ponto de configuração:
 *  wss:// -> https:// | ws:// -> http:// | https?:// permanece.
 */
function getMeetOrigin() {
  const raw = process.env.MEET_URL || (isProduction() ? "" : DEV_MEET_URL);
  if (!raw) {
    throw new Error("MEET_URL não está configurada em produção.");
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`MEET_URL inválida: "${raw}".`);
  }

  const protocolMap = { "wss:": "https:", "ws:": "http:", "https:": "https:", "http:": "http:" };
  const protocol = protocolMap[parsed.protocol];
  if (!protocol) {
    throw new Error(`MEET_URL com protocolo não suportado: "${raw}". Use wss:// ou https://.`);
  }

  return `${protocol}//${parsed.host}`;
}

/** Diretório onde a plataforma grava os grupos do Galene. */
function getGroupsDir() {
  if (process.env.GALENE_GROUPS_DIR) {
    return path.resolve(process.env.GALENE_GROUPS_DIR);
  }
  return path.resolve(process.cwd(), "galene", "groups");
}

function validateRoomId(roomId) {
  if (typeof roomId !== "string" || !ROOM_ID_PATTERN.test(roomId)) {
    throw new ValidationError({ message: "Identificador de sala inválido." });
  }
}

/** Valida o slug do estúdio (escopo do grupo Galene). */
function validateStudioSlug(studioSlug) {
  if (typeof studioSlug !== "string" || !STUDIO_SLUG_PATTERN.test(studioSlug)) {
    throw new ValidationError({ message: "Identificador de estúdio inválido." });
  }
}

/** Normaliza o nome exibido na sala (limita tamanho e caracteres de controle). */
function sanitizeDisplayName(value) {
  if (typeof value !== "string" || !value.trim()) {
    return DEFAULT_DISPLAY_NAME;
  }
  const cleaned = value
    .normalize("NFKC")
    .split("")
    .filter((char) => {
      const codePoint = char.codePointAt(0);
      return codePoint >= 0x20 && codePoint !== 0x7f;
    })
    .join("")
    .trim()
    .slice(0, 40);
  return cleaned || DEFAULT_DISPLAY_NAME;
}

/**
 * Normaliza o nome do estúdio exibido no topo da sala (propriedade
 * `displayName` do grupo Galene). Vazio quando ausente/inválido — nesse
 * caso o Galene mantém o fallback padrão (nome do grupo capitalizado).
 * @param {*} value
 * @returns {string}
 */
function sanitizeRoomTitle(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }
  const cleaned = value
    .normalize("NFKC")
    .split("")
    .filter((char) => {
      const codePoint = char.codePointAt(0);
      return codePoint >= 0x20 && codePoint !== 0x7f;
    })
    .join("")
    .trim()
    .slice(0, 80);
  return cleaned;
}

/**
 * Monta o objeto JSON do grupo Galene de um ESTÚDIO
 * (arquivo `groups/<estudio>.json`).
 * @param {string} keyB64 chave HS256 em base64url (authKeys).
 * @param {string} [displayName] nome do estúdio exibido no topo das salas.
 * @returns {Record<string, unknown>}
 */
function groupFileObject(keyB64, displayName) {
  // Só campos que existem na struct `Description` de
  // galene/group/description.go: ela é lida com `DisallowUnknownFields`, então
  // um campo desconhecido faz o decode falhar e a sala inteira não carregar.
  // (`allow-anonymous` saiu daqui: está obsoleto desde o Galene 0.9 e é
  // ignorado pelo servidor.)
  const group = {
    comment: "Estúdio provisionado pela plataforma (Webconferência IndiesBrasil)",
    // Sem isto o Galene não aceita os subgrupos: `readDescription` devolve
    // ErrNotExist quando o arquivo resolvido é de um pai sem auto-subgroups,
    // e então TODAS as salas do estúdio deixam de abrir.
    "auto-subgroups": true,
    authKeys: [{ kty: "oct", alg: "HS256", k: keyB64 }],
  };

  const roomTitle = sanitizeRoomTitle(displayName);
  if (roomTitle) {
    group.displayName = roomTitle;
  }

  return group;
}

/**
 * Garante que o grupo `groups/<estudio>.json` exista no Galene com a authKeys
 * vigente. Escreve de forma atômica (tmp + rename) para o Galene nunca ler um
 * JSON parcial, e pula a gravação quando o conteúdo já está atualizado.
 *
 * É idempotente e não tem estado por reunião: pode ser chamada a cada entrada
 * em sala, sem risco de acumular arquivos (era o que acontecia no modelo de um
 * arquivo por reunião, que deixava sala órfã depois que a reunião terminava).
 * @param {string} studioSlug slug do estúdio (escopo do grupo).
 * @param {string} [displayName] nome do estúdio (título exibido na sala).
 * @returns {Promise<boolean>} true quando um arquivo novo foi gravado.
 */
async function ensureStudioGroup(studioSlug, displayName) {
  validateStudioSlug(studioSlug);

  const { encoded } = getAuthSecret();
  const groupsDir = getGroupsDir();
  const filePath = path.join(groupsDir, `${studioSlug}.json`);
  const content = `${JSON.stringify(groupFileObject(encoded, displayName), null, 2)}\n`;

  await mkdir(groupsDir, { recursive: true });

  try {
    const existing = await readFile(filePath, "utf8");
    if (existing === content) return false;
  } catch {
    // Arquivo ainda não existe — segue para a gravação.
  }

  const tmpPath = path.join(groupsDir, `${studioSlug}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`);
  await writeFile(tmpPath, content, { encoding: "utf8" });
  await rename(tmpPath, filePath);
  return true;
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function signToken(signingInput, keyBytes) {
  return crypto.createHmac("sha256", keyBytes).update(signingInput).digest("base64url");
}

/**
 * Data de expiração do token: o mais cedo entre o término da reunião, a
 * expiração do código (convidados) e o teto de 12h a partir de agora.
 */
function computeExpiry(endsAt, codeExpiresAt) {
  const nowMs = Date.now();
  const boundsMs = [endsAt, codeExpiresAt]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .map((value) => new Date(value).getTime())
    .filter((ts) => Number.isFinite(ts) && ts > nowMs);

  if (!boundsMs.length) {
    throw new ValidationError({
      message: "A reunião não está mais disponível para acesso.",
    });
  }

  const capMs = nowMs + MAX_TOKEN_TTL_SECONDS * 1000;
  return new Date(Math.min(...boundsMs, capMs));
}

/**
 * Nome do grupo Galene de uma sala: `<estudio>/<reuniao>`.
 *
 * O Galene resolve esse caminho pelo arquivo do ESTÚDIO com
 * `"auto-subgroups": true`: `getDescriptionFile` sobe a hierarquia
 * (`groups/<estudio>/<reuniao>.json` → `groups/<estudio>.json`) e
 * `readDescription` aceita o pai quando auto-subgroups está ligado.
 * @param {string} studioSlug
 * @param {string} roomId
 * @returns {string}
 */
function roomGroupName(studioSlug, roomId) {
  validateStudioSlug(studioSlug);
  validateRoomId(roomId);
  return `${studioSlug}/${roomId}`;
}

/**
 * Emite o JWT de acesso e monta a URL de entrada do cliente oficial.
 * @param {{ studio: string, roomId: string, username?: string, permissions: string[], endsAt: string|Date, codeExpiresAt?: string|Date }} options
 * @returns {Promise<{ joinUrl: string, token: string, expiresAt: string }>}
 */
async function createJoinTokenAndUrl({ studio, roomId, username, permissions, endsAt, codeExpiresAt }) {
  const groupName = roomGroupName(studio, roomId);

  const displayName = sanitizeDisplayName(username);
  const expiry = computeExpiry(endsAt, codeExpiresAt);
  const origin = getMeetOrigin();
  // Escopo do token: o ESTÚDIO, não a sala.
  // Com `include-subgroups`, o Galene casa a audiência por PREFIXO
  // (galene/token/jwt.go → matchGroup): comparando `/group/<estudio>/<sala>/`
  // com `/group/<estudio>/`, este token abre qualquer sala do estúdio — e
  // nenhuma de outro. Assim não é preciso reemitir o token a cada reunião
  // criada, e o estrago de um token vazado fica contido no estúdio.
  const aud = `${origin}/group/${studio}/`;

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud,
    exp: Math.floor(expiry.getTime() / 1000),
    iat: now,
    sub: displayName,
    permissions: Array.isArray(permissions) ? permissions : [],
    "include-subgroups": true,
  };

  const headerB64 = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = signToken(signingInput, getAuthSecret().keyBytes);
  const token = `${headerB64}.${payloadB64}.${signature}`;

  const joinUrl = `${origin}/group/${groupName}/?username=${encodeURIComponent(displayName)}&token=${encodeURIComponent(token)}`;

  return { joinUrl, token, expiresAt: expiry.toISOString() };
}

const galene = {
  GALENE_PERMISSIONS,
  getAuthSecret,
  getMeetOrigin,
  getGroupsDir,
  sanitizeDisplayName,
  roomGroupName,
  ensureStudioGroup,
  createJoinTokenAndUrl,
};

export default galene;
