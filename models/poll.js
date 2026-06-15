import database from "infra/database";
import { NotFoundError, ValidationError } from "@/infra/errors";

async function create(question, options) {
  // Cria a enquete
  const pollResult = await database.query({
    text: `
      INSERT INTO polls (question)
      VALUES ($1)
      RETURNING id
    `,
    values: [question],
  });
  const pollId = pollResult.rows[0].id;

  // Cria as opções
  const inserted = [];
  for (const label of options) {
    const result = await database.query({
      text: `
        INSERT INTO poll_options (poll_id, label)
        VALUES ($1, $2)
        RETURNING id, label, created_at
      `,
      values: [pollId, label.trim()],
    });
    inserted.push(result.rows[0]);
  }
  return { id: pollId, options: inserted };
}

async function getPollByPostId(postId) {
  const result = await database.query({
    text: `
      SELECT p.id, p.question, p.ended_at
      FROM polls p
      JOIN posts ps ON ps.poll_id = p.id
      WHERE ps.id = $1
    `,
    values: [postId],
  });
  if (result.rowCount === 0) return null;
  return result.rows[0];
}

async function vote(pollOptionId, userId) {
  const option = await database.query({
    text: `
      SELECT po.id, po.poll_id, pl.ended_at
      FROM poll_options po
      JOIN polls pl ON pl.id = po.poll_id
      WHERE po.id = $1
    `,
    values: [pollOptionId],
  });

  if (option.rowCount === 0) {
    throw new NotFoundError({ message: "Opção de enquete não encontrada." });
  }

  const { ended_at } = option.rows[0];

  if (ended_at) {
    throw new ValidationError({ message: "Enquete já encerrada." });
  }

  // Toggle: se já votou nessa opção, remove
  const existing = await database.query({
    text: `SELECT id FROM poll_votes WHERE poll_option_id = $1 AND user_id = $2`,
    values: [pollOptionId, userId],
  });

  if (existing.rowCount > 0) {
    await database.query({
      text: `DELETE FROM poll_votes WHERE id = $1`,
      values: [existing.rows[0].id],
    });
    return { voted: false };
  }

  // Remove voto anterior em outra opção da mesma enquete
  await database.query({
    text: `
      DELETE FROM poll_votes
      WHERE user_id = $1
        AND poll_option_id IN (
          SELECT id FROM poll_options WHERE poll_id = (
            SELECT poll_id FROM poll_options WHERE id = $2
          )
        )
    `,
    values: [userId, pollOptionId],
  });

  await database.query({
    text: `
      INSERT INTO poll_votes (poll_option_id, user_id)
      VALUES ($1, $2)
    `,
    values: [pollOptionId, userId],
  });

  return { voted: true };
}

async function endPoll(postId, userId) {
  const pollData = await database.query({
    text: `SELECT pl.id, p.author_id, pl.ended_at
           FROM polls pl
           JOIN posts p ON p.poll_id = pl.id
           WHERE p.id = $1`,
    values: [postId],
  });

  if (pollData.rowCount === 0) {
    throw new NotFoundError({ message: "Enquete não encontrada." });
  }

  const { author_id, ended_at } = pollData.rows[0];

  if (author_id !== userId) {
    throw new ValidationError({ message: "Apenas o criador pode encerrar a enquete." });
  }

  if (ended_at) {
    throw new ValidationError({ message: "Enquete já encerrada." });
  }

  await database.query({
    text: `UPDATE polls SET ended_at = timezone('utc', now())
           FROM posts p
           WHERE polls.id = p.poll_id AND p.id = $1`,
    values: [postId],
  });

  return { ended: true };
}

async function getUserVote(postId, userId) {
  const result = await database.query({
    text: `
      SELECT pv.poll_option_id, po.label
      FROM poll_votes pv
      JOIN poll_options po ON po.id = pv.poll_option_id
      JOIN polls pl ON pl.id = po.poll_id
      JOIN posts ps ON ps.poll_id = pl.id
      WHERE ps.id = $1 AND pv.user_id = $2
      LIMIT 1
    `,
    values: [postId, userId],
  });
  return result.rows[0] || null;
}

const poll = {
  create,
  getPollByPostId,
  vote,
  endPoll,
  getUserVote,
};

export default poll;
