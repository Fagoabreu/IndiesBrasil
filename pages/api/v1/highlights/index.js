import { createRouter } from "next-connect";
import controller from "infra/controller";
import database from "infra/database";

export default createRouter().get(getHandler).handler(controller.errorHandlers);

async function getHandler(request, response) {
  const [games, boardgames, books] = await Promise.all([
    getRandomItems("games", "name"),
    getRandomItems("boardgames", "name"),
    getRandomItems("books", "title"),
  ]);

  const highlights = [];

  if (games) {
    highlights.push({ type: "game", ...games });
  }
  if (boardgames) {
    highlights.push({ type: "boardgame", ...boardgames });
  }
  if (books) {
    highlights.push({ type: "book", ...books });
  }

  return response.status(200).json(highlights);
}

async function getRandomItems(table, nameField) {
  const hasMediaJoin = table === "games" || table === "boardgames";
  const mediaJoin = hasMediaJoin
    ? table === "games"
      ? `LEFT JOIN LATERAL (SELECT url AS media_url FROM game_media WHERE game_id = t.id AND media_type = 'video' LIMIT 1) media ON true`
      : `LEFT JOIN LATERAL (SELECT url AS media_url FROM boardgame_media WHERE boardgame_id = t.id AND media_type = 'video' LIMIT 1) media ON true`
    : "";

  const result = await database.query({
    text: `
      SELECT
        t.id,
        t.${nameField} AS name,
        t.slug,
        t.short_description,
        ${
          table === "books" ? `COALESCE(ui_cover.secure_url, t.cover_url_external)` : `COALESCE(ui_ban.secure_url, ui_cover.secure_url)`
        } AS banner_url,
        o.name AS studio_name,
        o.slug AS studio_slug,
        ui_logo.secure_url AS studio_logo_url
        ${hasMediaJoin ? ", media.media_url AS video_url" : ""}
      FROM ${table} t
      ${table !== "books" ? `LEFT JOIN uploaded_images ui_ban ON ui_ban.id = t.banner_image_id` : ""}
      LEFT JOIN uploaded_images ui_cover ON ui_cover.id = t.cover_image_id
      LEFT JOIN organizations o          ON o.id = t.owner_org_id
      LEFT JOIN uploaded_images ui_logo  ON ui_logo.id = o.img
      ${mediaJoin}
      WHERE o.name IS NOT NULL
        AND (
          ${table === "books" ? "ui_cover.secure_url IS NOT NULL OR t.cover_url_external IS NOT NULL" : "ui_ban.secure_url IS NOT NULL OR ui_cover.secure_url IS NOT NULL"}
          ${hasMediaJoin ? "OR media.media_url IS NOT NULL" : ""}
        )
      ORDER BY RANDOM()
      LIMIT 1
    `,
  });

  return result.rows[0] || null;
}
