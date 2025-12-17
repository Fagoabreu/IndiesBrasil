import database from "infra/database.js";
import email from "infra/email.js";
import { ForbiddenError, NotFoundError, ValidationError } from "infra/errors.js";
import webserver from "infra/webserver.js";
import user from "./user.js";
import authorization from "./authorization.js";

const EXPIRATION_IN_MILLISECONDS = 60 * 60 * 1000; // 1 hora

async function findOneValidById(tokenId) {
  const activationTokenObject = await runSelectQuery(tokenId);
  return activationTokenObject;

  async function runSelectQuery(tokenId) {
    const results = await database.query({
      text: `
        SELECT 
          *
        FROM 
          user_activation_tokens
        WHERE 
          id = $1
          and expires_at > NOW()
          and used_at IS NULL
        LIMIT 1
        `,
      values: [tokenId],
    });

    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "O token de ativação utilizado não foi encontrado no sistema ou expirou.",
        action: "Faça um novo cadastro.",
      });
    }
    return results.rows[0];
  }
}

async function markTokenAsUsed(tokenId) {
  const activationTokenObject = await runUpdateQuery(tokenId);
  return activationTokenObject;

  async function runUpdateQuery(tokenId) {
    const results = await database.query({
      text: `
        update user_activation_tokens
        set 
          used_at = timezone('utc', NOW()),
          updated_at = timezone('utc', NOW())
        WHERE 
          id = $1
          and expires_at > NOW()
          and used_at IS NULL
        RETURNING 
          *
        `,
      values: [tokenId],
    });

    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "O token de ativação utilizado não foi encontrado no sistema ou expirou.",
        action: "Faça um novo cadastro.",
      });
    }
    return results.rows[0];
  }
}

async function create(userId) {
  const expiresAt = new Date(Date.now() + EXPIRATION_IN_MILLISECONDS);

  const newToken = await runInsertQuery(userId, expiresAt);
  return newToken;

  async function runInsertQuery(userId, expiresAt) {
    const results = await database.query({
      text: `
        INSERT INTO
          user_activation_tokens (user_id, expires_at)
        VALUES 
          ($1, $2)
        RETURNING 
          *
      `,
      values: [userId, expiresAt],
    });

    return results.rows[0];
  }
}

async function activateUserByUserId(userId) {
  const userToActivate = await user.findOneById(userId);

  if (!authorization.can(userToActivate, "read:activation_token")) {
    throw new ForbiddenError({
      message: "Você não pode mais utilizar tokens de ativação.",
      action: "Entre em contato com o suporte.",
    });
  }

  const activatedUser = await user.setFeatures(userId, ["create:session", "read:session"]);
  return activatedUser;
}

async function changePasswordByToken(tokenId, password) {
  if (!password || password.length < 6 || !tokenId) {
    throw new ValidationError({ cause: "Token ou senha inválida." });
  }

  const tokenData = await activation.findOneValidById(tokenId);
  const usertoPatch = await user.findOneById(tokenData.user_id);
  if (!authorization.can(usertoPatch, "read:activation_token") && !authorization.can(usertoPatch, "create:session")) {
    throw new ForbiddenError({
      message: "Você não pode mudar a senha.",
      action: "Entre em contato com o suporte.",
    });
  }
  await user.update(usertoPatch.username, { password });
  const usedActivationToken = await activation.markTokenAsUsed(tokenId);
  return usedActivationToken;
}

async function sendEmailToUser(user, activationToken) {
  await email.send({
    from: "IndiesBrasil <contato@indies.com.br>",
    to: user.email,
    subject: "Ative seu cadastro no IndieX!",
    text: `${user.username}, clique no link abaixo para finalizar o cadastro

${webserver.origin}/cadastro/ativar/${activationToken.id}

Atenciosamente
Equipe Indies Brasil`,
  });
}

async function sendPasswordEmailToUser(user, activationToken) {
  await email.send({
    from: "IndiesBrasil <contato@indies.com.br>",
    to: user.email,
    subject: "Redefinição de senha",
    text: `${user.username}, Para redefinir sua senha clique no link abaixo:

${webserver.origin}/cadastro/reset-password/${activationToken.id}

Atenciosamente
Equipe Indies Brasil`,
  });
}

const activation = {
  create,
  sendEmailToUser,
  sendPasswordEmailToUser,
  markTokenAsUsed,
  findOneValidById,
  activateUserByUserId,
  changePasswordByToken,
  EXPIRATION_IN_MILLISECONDS,
};

export default activation;
