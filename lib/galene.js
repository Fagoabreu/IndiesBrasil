import crypto from "node:crypto";
import path from "node:path";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
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
 *  4. Encerrar uma sala: trancar (`lock`) para expulsar os participantes e
 *     gravar o arquivo da sala com `expires` no passado, para o bloqueio
 *     sobreviver a um reinício do Galene.
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
 * Só o encerramento cria arquivo por reunião, e ele é temporário: existe
 * enquanto `ends_at` é futuro (é o que mantém a sala fechada após um restart) e
 * é removido por `pruneClosedRooms` depois disso.
 *
 * Variáveis de ambiente:
 *  GALENE_AUTH_SECRET      chave HS256 (32 bytes, base64url). Obrigatória em
 *                          produção; em desenvolvimento usa um fallback fixo.
 *  GALENE_GROUPS_DIR       diretório dos grupos do Galene (bind-mount). Padrão:
 *                          galene/groups (o mesmo diretório que o compose de
 *                          dev monta); em produção o deploy define /app/groups.
 *  GALENE_INTERNAL_WS_URL  WebSocket interno do Galene, usado só para trancar a
 *                          sala ao encerrar a reunião. Padrão em dev:
 *                          ws://localhost:8000/ws; em produção o deploy define
 *                          ws://host.docker.internal:8000/ws.
 *  MEET_URL                base do servidor, ex. wss://meet.jogos.social.br.
 *                          O origin da página (https) é derivado daqui.
 *  CLOUDINARY_CLOUD_NAME   quando definido, habilita o avatar do participante
 *                          (o prefixo aceito é derivado daqui).
 *
 * Sem IA: o servidor Galene roda sem MediaPipe/background blur (Dockerfile),
 * e a plataforma apenas provisiona grupo + token (D1/D3).
 */

const DEV_AUTH_SECRET_BASE64URL = "eYjgxtLP_xoU9Q8nhK0NQBIaJ8Ins1uC3jqU_yTifbs";
const DEV_MEET_URL = "ws://localhost:8000";

/**
 * WebSocket interno do Galene em dev: o app roda no host (`npm run dev`) e o
 * container publica a 8000, então `localhost` resolve. Em produção o valor vem
 * de `GALENE_INTERNAL_WS_URL` — o app está em container e o Galene usa
 * `network_mode: host`, logo é `ws://host.docker.internal:8000/ws`.
 */
const DEV_INTERNAL_WS_URL = "ws://localhost:8000/ws";

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

/**
 * `op` é exigido para trancar a sala (`groupaction lock`, galene/rtpconn/
 * webclient.go:1664). Só o token efêmero do moderador usa este conjunto — nunca
 * o token de um participante, porque `op` também permite kick e mute.
 */
const GALENE_MODERATOR_PERMISSIONS = Object.freeze(["present", "message", "caption", "op"]);

/** Host público das imagens. O cliente só renderiza avatar vindo daqui. */
const AVATAR_HOST = "res.cloudinary.com";

/** Teto da URL do avatar (o `secure_url` do Cloudinary tem ~150 caracteres). */
const MAX_AVATAR_URL_LENGTH = 512;

/** Teto do `back` (URL da reunião na plataforma). */
const MAX_BACK_URL_LENGTH = 512;

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

/**
 * Prefixo aceito para URLs de avatar: `https://res.cloudinary.com/<cloud>/`.
 * Vazio quando o cloud name não está configurado — sem prefixo não há avatar
 * (fail-closed), em vez de aceitar qualquer host.
 * @returns {string}
 */
function getAvatarPrefix() {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloud || !/^[a-z0-9_-]+$/i.test(cloud)) return "";
  return `https://${AVATAR_HOST}/${cloud}/`;
}

/**
 * Valida a URL do avatar antes de entregá-la ao cliente da webconferência.
 *
 * O prefixo fixa esquema, host e cloud: nada além do nosso Cloudinary passa.
 * Isso importa porque o avatar é replicado a todos os participantes e o
 * navegador de cada um busca a imagem — um host arbitrário viraria rastreador
 * de IP. O Galene é SFU e não expõe IP entre participantes, então aceitar
 * qualquer URL seria uma regressão de privacidade.
 * @param {*} value
 * @returns {string} URL aceita, ou "" quando inválida.
 */
function sanitizeAvatarUrl(value) {
  const prefix = getAvatarPrefix();
  if (!prefix || typeof value !== "string") return "";
  if (!value || value.length > MAX_AVATAR_URL_LENGTH) return "";
  if (!value.startsWith(prefix)) return "";

  // O prefixo já fixa esquema, host e cloud; o que vem depois só pode ser
  // caminho/query/fragmento. Ainda assim recusamos `..` para que a URL não
  // seja usada como vetor em nenhum consumidor futuro.
  const rest = value.slice(prefix.length);
  if (rest.includes("..")) return "";

  return value;
}

/**
 * Valida a URL de retorno para a plataforma (`?back=`), usada pelo botão de
 * sair/reconectar do cliente. Mesma origem do MEET_URL não serve — a reunião
 * vive no domínio principal — então aqui validamos apenas que é http(s) e
 * limitamos o tamanho. O cliente só a usa como destino de navegação.
 * @param {*} value
 * @returns {string}
 */
function sanitizeBackUrl(value) {
  if (typeof value !== "string" || !value) return "";
  if (value.length > MAX_BACK_URL_LENGTH) return "";

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return "";
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
  return value;
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
 * @param {{ studio: string, roomId: string, username?: string, avatar?: string|null, back?: string|null, permissions: string[], endsAt: string|Date, codeExpiresAt?: string|Date }} options
 * @returns {Promise<{ joinUrl: string, token: string, expiresAt: string }>}
 */
async function createJoinTokenAndUrl({ studio, roomId, username, avatar, back, permissions, endsAt, codeExpiresAt }) {
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

  // Parâmetros extras vão DEPOIS de `token` para preservar o formato da URL
  // (os testes e o cliente dependem da ordem) e só aparecem quando aplicáveis.
  let extra = "";

  // O avatar viaja na URL, e não no JWT, porque o token é individual: cada
  // cliente só lê o próprio. O PREFIXO acompanha para que TODOS os clientes
  // validem o avatar dos OUTROS contra o nosso Cloudinary — sem ele, um
  // participante poderia publicar um host arbitrário e rastrear quem assiste.
  const avatarPrefix = getAvatarPrefix();
  if (avatarPrefix) {
    extra += `&avatarPrefix=${encodeURIComponent(avatarPrefix)}`;
    const avatarUrl = sanitizeAvatarUrl(avatar);
    if (avatarUrl) extra += `&avatar=${encodeURIComponent(avatarUrl)}`;
  }

  // `back`: para onde o cliente volta ao sair (a página da reunião na
  // plataforma). Sem isso o cliente não tem como oferecer uma saída que não
  // seja o formulário de senha do Galene — que nas nossas salas nunca funciona,
  // porque a autenticação é só por token.
  const backUrl = sanitizeBackUrl(back);
  if (backUrl) extra += `&back=${encodeURIComponent(backUrl)}`;

  const joinUrl = `${origin}/group/${groupName}/?username=${encodeURIComponent(displayName)}&token=${encodeURIComponent(token)}${extra}`;

  return { joinUrl, token, expiresAt: expiry.toISOString() };
}

/** Timeout do handshake/ação de moderação contra o Galene. */
const LOCK_TIMEOUT_MS = 8000;

/** Nome exibido pelo moderador efêmero que tranca a sala. */
const MODERATOR_DISPLAY_NAME = "IndiesBrasil";

/**
 * URL interna do WebSocket do Galene (`GALENE_INTERNAL_WS_URL`).
 *
 * O app fala com o Galene pelo mesmo host (loopback no dev; host-gateway em
 * produção, porque o serviço usa `network_mode: host`). Não é o MEET_URL: aquele
 * é o domínio público, que o container não alcança.
 */
function getInternalWsUrl() {
  const url = process.env.GALENE_INTERNAL_WS_URL || (isProduction() ? "" : DEV_INTERNAL_WS_URL);
  if (!url) {
    // Não degradar em silêncio: sem isto não há como expulsar ninguém, e um
    // "encerrado" que não encerra é pior que um erro explícito.
    throw new Error("GALENE_INTERNAL_WS_URL não está configurada: não é possível encerrar a sala no Galene.");
  }
  return url;
}

/**
 * Entra na sala com um token de moderador e envia `groupaction lock`.
 *
 * Por que um WebSocket daqui: `locked` é estado EM MEMÓRIA do servidor e a
 * única forma de setá-lo é a ação de grupo `lock`
 * (galene/rtpconn/webclient.go → `SetLocked`). Ela exige a permissão `op` e o
 * servidor a aplica ao grupo do PRÓPRIO cliente (`c.group`), logo é preciso
 * entrar na sala.
 *
 * Os caminhos alternativos não expulsam ninguém — conferido contra a tag
 * 1.2.1: `group.Delete` desiste quando há clientes conectados
 * (`deleteUnlocked`); `DELETE /galene-api/v0/.groups/<g>/` apaga só o arquivo
 * (`DeleteDescription`); e `desc.Expires` é lido exclusivamente em `AddClient`,
 * então barra entrada nova mas não tira quem já está dentro.
 *
 * `SetLocked` empurra `Joined("change")` a todos os clientes e o tratamento de
 * `joinedAction` responde com `g.Status(true, nil)` (`authentified = true`) —
 * por isso `locked: true` chega aos participantes e o cliente se retira
 * (customização 7 do cliente).
 * @param {string} wsUrl
 * @param {string} groupName `<estudio>/<reuniao>`
 * @param {string} token JWT com `op`
 * @param {string} message motivo exibido aos participantes
 */
function sendLockAction(wsUrl, groupName, token, message) {
  const id = crypto.randomBytes(8).toString("hex");
  const username = MODERATOR_DISPLAY_NAME;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let settled = false;
    let joined = false;

    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // Já fechado — nada a fazer.
      }
      if (error) reject(error);
      else resolve();
    };

    const timer = setTimeout(() => finish(new Error("Timeout ao trancar a sala no Galene.")), LOCK_TIMEOUT_MS);

    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "handshake", version: ["2"], id }));
    });

    ws.addEventListener("error", () => finish(new Error("Falha de WebSocket ao trancar a sala no Galene.")));

    ws.addEventListener("close", () => finish(new Error("A conexão com o Galene foi fechada antes de trancar a sala.")));

    ws.addEventListener("message", (event) => {
      let m;
      try {
        m = JSON.parse(String(event.data));
      } catch {
        return; // mensagem não-JSON: ignora
      }

      if (m.type === "handshake") {
        ws.send(JSON.stringify({ type: "join", kind: "join", group: groupName, username, token }));
        return;
      }

      if (m.type === "error") {
        finish(new Error(`O Galene recusou a ação de moderação: ${m.message || ""}`));
        return;
      }

      if (m.type !== "joined") return;

      if (m.kind === "fail") {
        finish(new Error(`O Galene recusou o moderador: ${m.message || m.error || "sem detalhes"}`));
        return;
      }

      if (m.kind === "join" && !joined) {
        joined = true;
        ws.send(JSON.stringify({ type: "groupaction", source: id, kind: "lock", username, value: message }));
        // O `lock` não tem resposta própria: a confirmação é o `joined/change`
        // com `status.locked`, logo abaixo.
        return;
      }

      if (m.kind === "change" && m.status?.locked) {
        finish();
      }
    });
  });
}

/**
 * Tranca a sala e expulsa os participantes.
 *
 * O token do moderador é efêmero (2 minutos) e nunca é entregue a ninguém —
 * ele carrega `op`, que também permite kick e mute. O token do participante
 * continua sem `op`.
 * @param {string} studioSlug
 * @param {string} roomId
 * @param {string} [message]
 */
async function lockRoom(studioSlug, roomId, message) {
  const wsUrl = getInternalWsUrl();
  const groupName = roomGroupName(studioSlug, roomId);

  const access = await createJoinTokenAndUrl({
    studio: studioSlug,
    roomId,
    username: MODERATOR_DISPLAY_NAME,
    permissions: GALENE_MODERATOR_PERMISSIONS,
    endsAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
  });

  await sendLockAction(wsUrl, groupName, access.token, message || "Esta reunião foi encerrada pelo organizador.");
}

/**
 * Fecha a sala no disco, para que ela continue fechada mesmo se o Galene
 * reiniciar (o `lock` acima é estado em memória e se perde no restart).
 *
 * Grava `groups/<estudio>/<roomId>.json` com as `authKeys` vigentes e
 * `expires` no passado. Como nossas permissões de participante não incluem
 * `op`, o `AddClient` recusa a entrada — inclusive com um token já emitido.
 * @param {string} studioSlug
 * @param {string} roomId
 */
async function closeRoom(studioSlug, roomId) {
  validateStudioSlug(studioSlug);
  validateRoomId(roomId);

  const { encoded } = getAuthSecret();
  const groupsDir = getGroupsDir();

  // Ao existir um arquivo para a SALA, o Galene deixa de subir a hierarquia
  // (`getDescriptionFile`) e a sala para de herdar o `displayName` do estúdio.
  // Sem esta cópia, o título da sala mudaria no instante do encerramento.
  let studioTitle = "";
  try {
    studioTitle = sanitizeRoomTitle(JSON.parse(await readFile(path.join(groupsDir, `${studioSlug}.json`), "utf8")).displayName);
  } catch {
    // Estúdio ainda não provisionado: a sala fecha sem título próprio.
  }

  const group = {
    comment: "Sala encerrada pela plataforma (Webconferência IndiesBrasil)",
    authKeys: [{ kty: "oct", alg: "HS256", k: encoded }],
    expires: new Date(0).toISOString(),
  };
  if (studioTitle) group.displayName = studioTitle;

  const dir = path.join(groupsDir, studioSlug);
  await mkdir(dir, { recursive: true });

  const content = `${JSON.stringify(group, null, 2)}\n`;
  const tmpPath = path.join(dir, `${roomId}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`);
  await writeFile(tmpPath, content, { encoding: "utf8" });
  await rename(tmpPath, path.join(dir, `${roomId}.json`));

  return true;
}

/**
 * Remove os arquivos das salas que já passaram do horário (`ends_at`).
 *
 * O arquivo de uma sala encerrada só serve enquanto o `expires` ainda está no
 * futuro — é ele que segura a sala fechada se o Galene reiniciar. Depois que a
 * janela agendada passa, o arquivo é lixo: ninguém mais teria como entrar de
 * qualquer forma (o `assertCanJoin` da plataforma já bloqueia).
 *
 * Por isso a regra é `ends_at > agora` (o que ainda importa), e NÃO "status da
 * reunião": uma reunião encerrada antes do tempo tem `ends_at` no futuro e
 * precisa manter o arquivo.
 * @param {string} studioSlug
 * @param {string[]} keepRoomIds room_ids cujo `ends_at` ainda não passou.
 * @returns {Promise<number>} quantos arquivos foram removidos.
 */
async function pruneClosedRooms(studioSlug, keepRoomIds) {
  validateStudioSlug(studioSlug);

  const dir = path.join(getGroupsDir(), studioSlug);
  const keep = new Set(keepRoomIds || []);

  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return 0; // diretório inexistente: nada a limpar
  }

  let removed = 0;
  for (const name of entries) {
    if (!name.endsWith(".json")) continue;

    const roomId = name.slice(0, -".json".length);
    // Não toca em nome fora do padrão (ex.: `.tmp` de uma gravação em curso).
    if (!ROOM_ID_PATTERN.test(roomId)) continue;
    if (keep.has(roomId)) continue;

    await rm(path.join(dir, name), { force: true });
    removed += 1;
  }

  return removed;
}

const galene = {
  GALENE_PERMISSIONS,
  GALENE_MODERATOR_PERMISSIONS,
  getAuthSecret,
  getMeetOrigin,
  getGroupsDir,
  getAvatarPrefix,
  sanitizeAvatarUrl,
  sanitizeBackUrl,
  sanitizeDisplayName,
  roomGroupName,
  ensureStudioGroup,
  createJoinTokenAndUrl,
  lockRoom,
  closeRoom,
  pruneClosedRooms,
};

export default galene;
