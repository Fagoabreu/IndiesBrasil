import database from "infra/database";
import { UnauthorizedError } from "infra/errors";
import crypto from "node:crypto";
const EXPIRATION_IN_MILLISECONDS = 1000 * 60 * 60 * 24 * 30; // 30 Days
const ABSOLUTE_MAX_SESSION_MS = 1000 * 60 * 60 * 24 * 90; // 90 Days absolute max

/**
 * SHA-256 em hexadecimal do token de sessão.
 *
 * ## Por que o banco guarda o hash, e não o token
 *
 * O token era gravado literalmente em `sessions.token`. Quem obtivesse um dump
 * do banco (backup vazado, acesso ao volume `postgres-data`) tinha **sessões
 * prontas para usar** — o bcrypt da senha não protege nada disso, porque a
 * sessão já está autenticada. Guardando o hash, o dump não permite autenticar:
 * o valor que o cliente precisa apresentar não está lá.
 *
 * Aqui o hash **não** precisa de sal nem de custo alto (diferente de senha):
 * o token tem 384 bits de aleatoriedade, então não há dicionário a atacar. O que
 * importa é ser determinístico — é a chave de busca, e por isso o índice único
 * em `token` continua funcionando igual.
 */
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Busca a sessão pelo token apresentado pelo cliente.
 *
 * Aceita **duas** formas de propósito: o hash (sessões novas) e o valor cru
 * (sessões criadas antes desta mudança). Sem isso, subir o código deslogaria
 * todo mundo de uma vez. Quando o token cru é encontrado, a linha é **convertida
 * na hora** (upgrade on read), então a janela de compatibilidade se fecha
 * sozinha conforme cada sessão é usada — em no máximo 30 dias não sobra nenhuma
 * em texto plano.
 *
 * As duas formas não se confundem: o token cru tem 96 caracteres hexadecimais
 * (48 bytes) e o hash tem 64, então um valor nunca casa a coluna do outro por
 * acidente.
 */
async function findOneValidByToken(sessionToken) {
  const hashedToken = hashToken(sessionToken);
  const sessionFound = await runSelectQuery(sessionToken, hashedToken);

  // `token` devolvido é o que o cliente apresentou: o do banco pode ser o hash,
  // e quem chama esta função usa o valor para reescrever o cookie.
  if (sessionFound.token !== hashedToken) {
    await runUpgradeQuery(sessionFound.id, hashedToken);
  }

  return { ...sessionFound, token: sessionToken };

  async function runSelectQuery(sessionToken, hashedToken) {
    const results = await database.query({
      text: `
      select *
      from
        sessions
      where
        (token = $1 or token = $2)
        and expires_at > now()
        and created_at > now() - interval '90 days'
      limit
        1;`,
      values: [hashedToken, sessionToken],
    });

    if (results.rowCount === 0) {
      throw new UnauthorizedError({
        message: "Usuario não possui sessão ativa.",
        action: "Verifique se o usuário está logado e tente novamente.",
      });
    }

    return results.rows[0];
  }

  /** Converte uma sessão legada (token cru) para a forma com hash. */
  async function runUpgradeQuery(sessionId, hashedToken) {
    await database.query({
      text: `
        update sessions
        set token = $2,
            updated_at = now()
        where id = $1
      `,
      values: [sessionId, hashedToken],
    });
  }
}

async function create(userId) {
  const token = crypto.randomBytes(48).toString("hex");
  const expiresAt = getExpitationDate();
  const newSession = await runInsertQuery(hashToken(token), userId, expiresAt);

  // O token cru existe só aqui e no cookie do cliente: é o único momento em que
  // ele é conhecido pelo servidor.
  return { ...newSession, token };

  async function runInsertQuery(hashedToken, userId, expiresAt) {
    const results = await database.query({
      text: `
        Insert into
          sessions(token,user_id,expires_at)
        values
          ($1,$2,$3)
        returning
          *
      ;`,
      values: [hashedToken, userId, expiresAt],
    });
    return results.rows[0];
  }
}

/**
 * Renova a validade da sessão.
 *
 * O `token` **não** muda ao renovar (só `expires_at`), então o retorno desta
 * função não deve alimentar o cookie: com o hash no banco, `row.token` é o hash
 * e gravá-lo no cookie invalidaria a sessão no pedido seguinte. Quem reescreve o
 * cookie usa o token que veio dele — ver `pages/api/v1/user/index.js`.
 */
async function renew(sessionId) {
  const expiresAt = getExpitationDate();
  const renewedSessionObject = await runUpdateQuery(sessionId, expiresAt);
  return renewedSessionObject;

  async function runUpdateQuery(sessionId, expiresAt) {
    const results = await database.query({
      text: `
        UPDATE
          sessions
        set
          expires_at = $2,
          updated_at = NOW()
        where
          id = $1
        returning
          *
        `,
      values: [sessionId, expiresAt],
    });
    return results.rows[0];
  }
}

async function expireById(sessionId) {
  const expiredSessionObject = await runUpdateQuery(sessionId);
  return expiredSessionObject;

  async function runUpdateQuery(sessionId) {
    const results = await database.query({
      text: `
      UPDATE
        sessions
      SET
        expires_at = expires_at - interval '1 year',
        updated_at= NOW()
      WHERE
        id = $1
      Returning
        *
      `,
      values: [sessionId],
    });
    return results.rows[0];
  }
}

function getExpitationDate() {
  return new Date(Date.now() + EXPIRATION_IN_MILLISECONDS);
}

async function invalidateAllUserSessions(userId) {
  await database.query({
    text: `
      UPDATE sessions
      SET expires_at = NOW() - interval '1 year',
          updated_at = NOW()
      WHERE user_id = $1
        AND expires_at > NOW()`,
    values: [userId],
  });
}

const session = {
  create,
  findOneValidByToken,
  renew,
  expireById,
  invalidateAllUserSessions,
  EXPIRATION_IN_MILLISECONDS,
  ABSOLUTE_MAX_SESSION_MS,
};

export default session;
