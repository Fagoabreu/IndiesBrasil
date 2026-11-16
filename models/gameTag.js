import database from "infra/database.js";
import { MAX_GAME_TAGS, normalizeTagName } from "lib/gameTags";
import { ValidationError } from "infra/errors";

/**
 * Tags de jogo — create-or-get sobre a tabela `tags` compartilhada com posts.
 *
 * ## Por que não reusa `models/tags.js`
 *
 * Aquela função é de post: extrai `#hashtag` do texto e tem validação quebrada
 * (`const tagLen = tagName.lenght` — `undefined` não é menor que 3 nem maior que
 * 50, então nunca recusa nada). Depender dela aqui deixaria tag de 1 letra entrar
 * pela ficha do jogo. Corrigir `lenght` é outra mudança, com efeito no cadastro
 * de post.
 *
 * A tabela é a mesma de propósito: tag é vocabulário livre em todo o site, e
 * duas tabelas divergiriam na primeira diferença de normalização.
 */

async function findByGame(gameId) {
  const result = await database.query({
    text: `SELECT t.name
           FROM game_tags gt
           INNER JOIN tags t ON t.id = gt.tag_id
           WHERE gt.game_id = $1
           ORDER BY t.name`,
    values: [gameId],
  });

  return result.rows.map((row) => row.name);
}

/**
 * Cria a tag se não existir e devolve a linha.
 *
 * `ON CONFLICT ... DO UPDATE` em vez de `DO NOTHING`: `DO NOTHING` não devolve
 * linha, e precisamos do `id` nas duas situações (a tag existir ou acabar de ser
 * criada). A atualização é um no-op (`name = tags.name`).
 */
async function ensureTag(name) {
  const normalized = normalizeTagName(name);

  if (!normalized) {
    throw new ValidationError({ message: "O nome da tag é obrigatório." });
  }

  const result = await database.query({
    text: `INSERT INTO tags (name) VALUES ($1)
           ON CONFLICT (name) DO UPDATE SET name = tags.name
           RETURNING id, name`,
    values: [normalized],
  });

  return result.rows[0];
}

/**
 * Troca as tags de um jogo.
 *
 * Resolve cada nome ANTES de apagar os vínculos antigos: se `ensureTag` falhar,
 * o jogo continua com as tags que tinha em vez de ficar sem nenhuma.
 */
async function replaceForGame(gameId, names) {
  const requested = [];

  for (const raw of Array.isArray(names) ? names : []) {
    const normalized = normalizeTagName(raw);
    if (!normalized) continue;
    if (!requested.includes(normalized)) requested.push(normalized);
  }

  if (requested.length > MAX_GAME_TAGS) {
    throw new ValidationError({
      message: `Um jogo pode ter no máximo ${MAX_GAME_TAGS} tags.`,
      action: "Escolha as mais representativas.",
    });
  }

  const tagIds = [];
  for (const name of requested) {
    tagIds.push((await ensureTag(name)).id);
  }

  await database.query({ text: "DELETE FROM game_tags WHERE game_id = $1", values: [gameId] });

  for (const tagId of tagIds) {
    await database.query({
      text: "INSERT INTO game_tags (game_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      values: [gameId, tagId],
    });
  }

  return findByGame(gameId);
}

/**
 * Tags mais usadas em jogos — alimenta o seletor de filtro da listagem.
 *
 * Só conta `game_tags`: uma tag que existe apenas em posts não é vocabulário de
 * jogo e não deve aparecer no filtro de jogos.
 */
async function findPopular(limit = 20) {
  const result = await database.query({
    text: `SELECT t.name, count(*)::int AS game_count
           FROM game_tags gt
           INNER JOIN tags t ON t.id = gt.tag_id
           GROUP BY t.name
           ORDER BY game_count DESC, t.name
           LIMIT $1`,
    values: [limit],
  });

  return result.rows;
}

const gameTag = {
  findByGame,
  ensureTag,
  replaceForGame,
  findPopular,
};

export default gameTag;
