import database from "infra/database.js";
import { REPUTATION_ACTIONS } from "lib/reputation-constants.js";

function getConfig(action) {
  return REPUTATION_ACTIONS[action] || null;
}

/**
 * Aplica pontos a um usuário por uma ação única, respeitando idempotência e
 * limite diário.
 *
 * @param {object} params
 * @param {string} params.userId       id do usuário a pontuar.
 * @param {string} params.action       chave em REPUTATION_ACTIONS.
 * @param {string|number} params.referenceId  identificador único do alvo
 *                                            (post, comentário, denúncia...).
 * @param {import("pg").Client} [params.client] cliente de transação aberta
 *                                            (reutiliza a transação do chamador).
 */
async function award({ userId, action, referenceId, client }) {
  const config = getConfig(action);
  if (!config) return null;

  if (client) {
    return applyAward(client, { userId, action, referenceId, config });
  }
  return database.transaction((tx) => applyAward(tx, { userId, action, referenceId, config }));
}

async function applyAward(client, { userId, action, referenceId, config }) {
  // Trava a linha do usuário para serializar premiações concorrentes e
  // garantir que o limite diário nunca seja ultrapassado (race-safe).
  const userResult = await client.query({
    text: "SELECT id FROM users WHERE id = $1 FOR UPDATE",
    values: [userId],
  });
  if (userResult.rowCount === 0) return null;

  // Idempotência: a mesma ação sobre o mesmo alvo nunca pontua duas vezes.
  const existing = await client.query({
    text: "SELECT 1 FROM reputation_events WHERE user_id = $1 AND action = $2 AND reference_id = $3 LIMIT 1",
    values: [userId, action, String(referenceId)],
  });
  if (existing.rowCount > 0) return null;

  // Limite diário (anti-vício): não recompensa uso compulsivo da rede.
  if (config.dailyLimit) {
    const countResult = await client.query({
      text: `
        SELECT COUNT(*)::int AS count
        FROM reputation_events
        WHERE user_id = $1
          AND action = $2
          AND created_at >= date_trunc('day', timezone('utc', now()))
      `,
      values: [userId, action],
    });
    if (countResult.rows[0].count >= config.dailyLimit) return null;
  }

  await client.query({
    text: "INSERT INTO reputation_events (user_id, action, points, reference_id) VALUES ($1, $2, $3, $4)",
    values: [userId, action, config.points, String(referenceId)],
  });

  await client.query({
    text: "UPDATE users SET reputation = reputation + $2, updated_at = now() WHERE id = $1",
    values: [userId, config.points],
  });

  return { action, points: config.points };
}

/**
 * Histórico de eventos de reputação de um usuário (mais recentes primeiro).
 */
async function findByUserId(userId, { limit = 50 } = {}) {
  const results = await database.query({
    text: `
      SELECT action, points, reference_id, created_at
      FROM reputation_events
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    values: [userId, limit],
  });
  return results.rows;
}

const reputation = {
  award,
  findByUserId,
};

export default reputation;
