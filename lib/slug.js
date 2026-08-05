import database from "infra/database";

/**
 * Cria a forma base (kebab-case) de um nome para uso em slugs.
 * Remove acentos, converte para minúsculas, substitui espaços e
 * caracteres especiais por hífen.
 *
 * @param {string} name — Nome original (ex: "Green Tale Studios")
 * @param {number} [maxLength=100] — Tamanho máximo da base
 * @returns {string} Base do slug (ex: "green-tale-studios")
 */
export function slugBase(name, maxLength = 100) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
}

/**
 * Gera um slug único para uma tabela, verificando colisões no banco.
 * Se a base já existir, adiciona sufixo numérico (-2, -3, …).
 *
 * @param {string} name — Nome original
 * @param {string} table — Nome da tabela (ex: "organizations")
 * @param {string} [column="slug"] — Nome da coluna de slug
 * @param {string} [currentSlug=null] — Slug atual (para excluir self em updates)
 * @param {number} [maxBaseLength=100] — Tamanho máximo da base
 * @returns {Promise<string>} Slug único
 */
export async function generateUniqueSlug(name, table, column = "slug", currentSlug = null, maxBaseLength = 100) {
  const base = slugBase(name, maxBaseLength);

  const existing = await database.query({
    text: `SELECT ${column} FROM ${table} WHERE ${column} LIKE $1 AND ${column} != $2 ORDER BY ${column}`,
    values: [`${base}%`, currentSlug || ""],
  });

  const slugs = new Set(existing.rows.map((r) => r[column]));
  if (!slugs.has(base)) return base;

  let i = 2;
  while (slugs.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
