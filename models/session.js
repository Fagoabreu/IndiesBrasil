import database from "infra/database";
import { UnauthorizedError } from "infra/errors";
import crypto from "node:crypto";
const EXPIRATION_IN_MILLISECONDS = 1000 * 60 * 60 * 24 * 30; // 30 Days

async function findOneValidByToken(sessionToken) {
  const sessionFound = await runSelectQuery(sessionToken);
  return sessionFound;

  async function runSelectQuery(sessionToken) {
    const results = await database.query({
      text: `
      select * 
      from 
        sessions
      where 
        token =$1
        and expires_at > now()
      limit 
        1;`,
      values: [sessionToken],
    });

    if (results.rowCount === 0) {
      throw new UnauthorizedError({
        message: "Usuario não possui sessão ativa.",
        action: "Verifique se o usuário está logado e tente novamente.",
      });
    }

    return results.rows[0];
  }
}

async function create(userId) {
  const token = crypto.randomBytes(48).toString("hex");
  const expiresAt = getExpitationDate();
  const newSession = await runInsertQuery(token, userId, expiresAt);
  return newSession;

  async function runInsertQuery(token, userId, expiresAt) {
    const results = await database.query({
      text: `
        Insert into
          sessions(token,user_id,expires_at)
        values
          ($1,$2,$3)
        returning
          *
      ;`,
      values: [token, userId, expiresAt],
    });
    return results.rows[0];
  }
}

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

const session = {
  create,
  findOneValidByToken,
  renew,
  expireById,
  EXPIRATION_IN_MILLISECONDS,
};

export default session;
