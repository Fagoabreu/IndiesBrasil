import { createRouter } from "next-connect";
import controller from "infra/controller";
import database from "infra/database";
import { HIGHLIGHTS_PER_TYPE } from "lib/highlights";

export default createRouter().get(getHandler).handler(controller.errorHandlers);

/**
 * Um registro por tipo de conteúdo que pode aparecer em destaque.
 *
 * A query é montada a partir daqui em vez de uma cascata de `if` por tabela: as
 * diferenças entre os tipos são só o nome da coluna de título, qual imagem vira
 * banner e se existe galeria de vídeo. A versão anterior tinha ternários
 * aninhados por tabela — era onde acrescentar um tipo faria esquecer o filtro
 * de moderação ou a condição de "tem imagem".
 *
 * `coverExpression` já resolve banner→capa (jogos e jogos de mesa) e a capa
 * externa de livros. É também o que define "tem imagem", sem uma segunda
 * expressão que pudesse divergir da primeira.
 */
const HIGHLIGHT_SOURCES = [
  {
    type: "game",
    table: "games",
    nameField: "name",
    moderationType: "game",
    coverExpression: "COALESCE(ui_ban.secure_url, ui_cover.secure_url)",
    bannerJoin: "LEFT JOIN uploaded_images ui_ban ON ui_ban.id = t.banner_image_id",
    media: { table: "game_media", column: "game_id" },
  },
  {
    type: "boardgame",
    table: "boardgames",
    nameField: "name",
    moderationType: "boardgame",
    coverExpression: "COALESCE(ui_ban.secure_url, ui_cover.secure_url)",
    bannerJoin: "LEFT JOIN uploaded_images ui_ban ON ui_ban.id = t.banner_image_id",
    media: { table: "boardgame_media", column: "boardgame_id" },
  },
  {
    type: "book",
    table: "books",
    nameField: "title",
    moderationType: "book",
    // Livro e quadrinho aceitam capa externa (`cover_url_external`), porque a
    // obra já pode estar publicada em outro lugar.
    coverExpression: "COALESCE(ui_cover.secure_url, t.cover_url_external)",
    bannerJoin: "",
    media: null,
  },
  {
    type: "asset",
    table: "assets",
    nameField: "name",
    moderationType: "asset",
    // Asset não tem banner nem capa externa: a única imagem é a capa opcional,
    // e é ela que o card desenha.
    coverExpression: "ui_cover.secure_url",
    bannerJoin: "",
    media: null,
  },
];

async function getHandler(request, response) {
  const rowsPerType = await Promise.all(HIGHLIGHT_SOURCES.map((source) => getRandomItems(source)));

  // `flat()` preserva a ordem de `HIGHLIGHT_SOURCES` (jogos, jogos de mesa,
  // livros, assets). É essa ordem que o grid usa para agrupar uma coluna por
  // tipo — cada linha carrega o próprio `type` para o card saber rótulo e rota.
  return response.status(200).json(rowsPerType.flat());
}

async function getRandomItems(source) {
  const mediaJoin = source.media
    ? `LEFT JOIN LATERAL (
          SELECT url AS media_url
          FROM ${source.media.table}
          WHERE ${source.media.column} = t.id
            AND media_type = 'video'
          LIMIT 1
        ) media ON true`
    : "";

  const mediaColumn = source.media ? ", media.media_url AS video_url" : "";

  // "Tem imagem" é exatamente o que o card precisa desenhar. Sem esta condição
  // a home mostrava card com placeholder no lugar da arte, que é o motivo de o
  // destaque existir.
  const imageCondition = source.media
    ? `(${source.coverExpression} IS NOT NULL OR media.media_url IS NOT NULL)`
    : `${source.coverExpression} IS NOT NULL`;

  const result = await database.query({
    text: `
      SELECT
        t.id,
        t.${source.nameField} AS name,
        t.slug,
        t.short_description,
        ${source.coverExpression} AS banner_url,
        o.name AS studio_name,
        o.slug AS studio_slug,
        ui_logo.secure_url AS studio_logo_url${mediaColumn}
      FROM ${source.table} t
      ${source.bannerJoin}
      LEFT JOIN uploaded_images ui_cover ON ui_cover.id = t.cover_image_id
      LEFT JOIN organizations o          ON o.id = t.owner_org_id
      LEFT JOIN uploaded_images ui_logo  ON ui_logo.id = o.img
      ${mediaJoin}
      WHERE o.name IS NOT NULL
        AND ${imageCondition}
        -- Mesmo filtro de moderação das listagens: conteúdo bloqueado — ou de
        -- estúdio bloqueado — não pode virar destaque, porque o card leva a uma
        -- página que responde 404. O endpoint não tinha esse filtro.
        AND NOT EXISTS (
          SELECT 1
          FROM moderation_actions ma
          WHERE ma.revoked_at IS NULL
            AND (ma.expires_at IS NULL OR ma.expires_at > now())
            AND (
              (ma.target_type = '${source.moderationType}' AND ma.target_id = t.id::text)
              OR (ma.target_type = 'studio' AND ma.target_id = t.owner_org_id::text)
            )
        )
      ORDER BY RANDOM()
      LIMIT $1
    `,
    values: [HIGHLIGHTS_PER_TYPE],
  });

  return result.rows.map((row) => ({ type: source.type, ...row }));
}
