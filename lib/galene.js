import crypto from "node:crypto";
import path from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { ValidationError } from "@/infra/errors";

/**
 * lib/galene.js — Provisionamento de salas Galene (webconference).
 *
 * Responsabilidades:
 *  1. Gravar o arquivo de grupo `groups/<room>.json` com a "authKeys" que o
 *     Galene usa para validar os JWTs emitidos pela plataforma (D3).
 *  2. Emitir o JWT HS256 de acesso com o formato aceito pelo Galene 1.1
 *     (contrato validado na Fase 0 — ver deploy/galene/gen-poc-secrets.js):
 *       aud  = "<origin>/group/<room>/"
 *       exp/iat = timestamps (segundos)
 *       sub  = nome de usuário exibido na sala
 *       permissions = permissões INTERNAS do Galene
 *  3. Montar a URL de entrada do cliente oficial:
 *       "<origin>/group/<room>/?username=<nome>&token=<jwt>"
 *
 * Variáveis de ambiente:
 *  GALENE_AUTH_SECRET   chave HS256 (32 bytes, base64url). Obrigatória em
 *                       produção; em desenvolvimento usa um fallback fixo.
 *  GALENE_GROUPS_DIR    diretório dos grupos do Galene (bind-mount). Padrão:
 *                       deploy/galene/groups (mesmo volume do compose local).
 *  MEET_URL             base do servidor, ex. wss://meet.jogos.social.br.
 *                       O origin da página (https) é derivado daqui.
 *
 * Sem IA: o servidor Galene roda sem MediaPipe/background blur (Dockerfile),
 * e a plataforma apenas provisiona grupo + token (D1/D3).
 */

const DEV_AUTH_SECRET_BASE64URL = "aW5kaWVzYnJhbC1kZXYtZ2FsZW5lLXNlY3JldC0zMi1ieXRlcyE=";
const DEV_MEET_URL = "ws://localhost:8000";

/** Teto de validade de um token de acesso (evita tokens de longa duração). */
const MAX_TOKEN_TTL_SECONDS = 12 * 60 * 60;

const DEFAULT_DISPLAY_NAME = "Convidado";

const ROOM_ID_PATTERN = /^[a-z0-9_-]{1,64}$/;

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
 * @returns {{ keyBytes: Buffer, encoded: string }}
 */
function getAuthSecret() {
  const encoded = process.env.GALENE_AUTH_SECRET || (isProduction() ? "" : DEV_AUTH_SECRET_BASE64URL);

  if (!encoded) {
    throw new Error("GALENE_AUTH_SECRET não está configurada em produção.");
  }

  const keyBytes = Buffer.from(encoded, "base64url");
  if (keyBytes.length < 32) {
    throw new Error("GALENE_AUTH_SECRET deve conter ao menos 32 bytes em base64url.");
  }

  return { keyBytes, encoded };
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
  return path.resolve(process.cwd(), "deploy", "galene", "groups");
}

function validateRoomId(roomId) {
  if (typeof roomId !== "string" || !ROOM_ID_PATTERN.test(roomId)) {
    throw new ValidationError({ message: "Identificador de sala inválido." });
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

function groupFileObject(keyB64) {
  return {
    comment: "Sala provisionada pela plataforma (Webconferência IndiesBrasil)",
    "allow-anonymous": false,
    authKeys: [{ kty: "oct", alg: "HS256", k: keyB64 }],
  };
}

/**
 * Garante que o grupo `groups/<roomId>.json` exista no Galene com a authKeys
 * vigente. Escreve de forma atômica (tmp + rename) para o Galene nunca ler um
 * JSON parcial, e pula a gravação quando o conteúdo já está atualizado.
 * @param {string} roomId
 * @returns {Promise<boolean>} true quando um arquivo novo foi gravado.
 */
async function ensureRoomProvisioned(roomId) {
  validateRoomId(roomId);

  const { encoded } = getAuthSecret();
  const groupsDir = getGroupsDir();
  const filePath = path.join(groupsDir, `${roomId}.json`);
  const content = `${JSON.stringify(groupFileObject(encoded), null, 2)}\n`;

  await mkdir(groupsDir, { recursive: true });

  try {
    const existing = await readFile(filePath, "utf8");
    if (existing === content) return false;
  } catch {
    // Arquivo ainda não existe — segue para a gravação.
  }

  const tmpPath = path.join(groupsDir, `${roomId}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`);
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
 * Emite o JWT de acesso e monta a URL de entrada do cliente oficial.
 * @param {{ roomId: string, username?: string, permissions: string[], endsAt: string|Date, codeExpiresAt?: string|Date }} options
 * @returns {Promise<{ joinUrl: string, token: string, expiresAt: string }>}
 */
async function createJoinTokenAndUrl({ roomId, username, permissions, endsAt, codeExpiresAt }) {
  validateRoomId(roomId);

  const displayName = sanitizeDisplayName(username);
  const expiry = computeExpiry(endsAt, codeExpiresAt);
  const origin = getMeetOrigin();
  const aud = `${origin}/group/${roomId}/`;

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud,
    exp: Math.floor(expiry.getTime() / 1000),
    iat: now,
    sub: displayName,
    permissions: Array.isArray(permissions) ? permissions : [],
  };

  const headerB64 = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = signToken(signingInput, getAuthSecret().keyBytes);
  const token = `${headerB64}.${payloadB64}.${signature}`;

  const joinUrl = `${origin}/group/${roomId}/?username=${encodeURIComponent(displayName)}&token=${encodeURIComponent(token)}`;

  return { joinUrl, token, expiresAt: expiry.toISOString() };
}

const galene = {
  GALENE_PERMISSIONS,
  getAuthSecret,
  getMeetOrigin,
  getGroupsDir,
  sanitizeDisplayName,
  ensureRoomProvisioned,
  createJoinTokenAndUrl,
};

export default galene;
