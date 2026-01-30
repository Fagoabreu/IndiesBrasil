import { NotFoundError, ValidationError } from "@/infra/errors";
import database from "infra/database";

async function create(tagName) {
  const tagLen = tagName.lenght;
  if (tagLen < 3 || tagLen > 50) {
    throw new ValidationError({ message: "Tamanho de Tag inválido.", action: "Verifique se as tags enviadas possuem entre 3 e 50 caracters" });
  }
  const newPost = await runInsertQuery(tagName.toLowerCase());
  return newPost;
  async function runInsertQuery(tagName) {
    const results = await database.query({
      text: `
      insert into
        tags (name)
      values
        ($1)
      returning
        *
      `,
      values: [tagName],
    });
    return results.rows[0];
  }
}

async function selectByName(tagName) {
  const newPost = await runInsertQuery(tagName.toLowerCase());
  return newPost;
  async function runInsertQuery(tagName) {
    const results = await database.query({
      text: `
      select 
        id,name,created_at 
      from
        tags
      where name=$1
      `,
      values: [tagName],
    });
    if (results.rowCount === 0) {
      throw new NotFoundError({ message: "Tag não encontrada", action: "Verifique se a tag foi digitada corretamente." });
    }
    return results.rows[0];
  }
}

function extractTags(content) {
  const matches = content.match(/#([\w]+)/g);
  if (!matches) return [];

  return [...new Set(matches.map((t) => t.replace("#", "").toLowerCase()))];
}

async function getTagsFromText(text) {
  const tagList = extractTags(text);
  const tags = await Promise.all(
    tagList.map(async (tagName) => {
      try {
        return await selectByName(tagName);
      } catch (e) {
        if (e instanceof NotFoundError) {
          return await create(tagName);
        }
        throw e;
      }
    }),
  );
  return Array.isArray(tags) ? tags : [];
}

async function getTrendingByPeriod(period, limit = 30) {
  const matchPeriod = period.match(/^\d+d$/);
  if (!matchPeriod) {
    throw new ValidationError({ message: "formato periodo inválido", action: "verifique o formato do período #número+d" });
  }
  const tags = await runSelectQuery(matchPeriod, limit);
  return tags;

  async function runSelectQuery(matchPeriod, limit) {
    const results = await database.query({
      text: `
    SELECT
      t.name,
      COUNT(pt.post_id) AS usage_count
    FROM post_tags pt
      inner JOIN tags t 
        ON t.id = pt.tag_id
    WHERE pt.created_at >= NOW() - INTERVAL '${matchPeriod}'
    GROUP BY t.name,pt.tag_id
    ORDER BY usage_count DESC
    LIMIT $1
    `,
      values: [limit],
    });
    if (results.rowCount === 0) {
      throw new NotFoundError({ message: "Tag não encontrada", action: "Verifique se a tag foi digitada corretamente." });
    }
    return results.rows;
  }
}

async function getSuggestByName(name, limit = 5) {
  if (name.length < 3) {
    throw new ValidationError({ message: "Parametro de busca insuficiente", action: "Tamanho minimo para pesquisa é de 3 caracteres" });
  }

  const tags = await runSelectQuery(`${name}%`, limit);
  return tags;

  async function runSelectQuery(name, limit) {
    const results = await database.query({
      text: `
        SELECT name
        FROM tags
        WHERE name ILIKE $1
        ORDER BY name
        LIMIT $2
    `,
      values: [name, limit],
    });
    if (results.rowCount === 0) {
      throw new NotFoundError({ message: "Tag não encontrada", action: "Verifique se a tag foi digitada corretamente." });
    }
    return results.rows;
  }
}

const tags = {
  extractTags,
  create,
  selectByName,
  getTagsFromText,
  getTrendingByPeriod,
  getSuggestByName,
};

export default tags;
