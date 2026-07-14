import database from "infra/database";
import uploadedImages from "./uploadedImages";

/**
 * Retorna as configurações de QR code vinculadas a um userId,
 * incluindo a URL da imagem de logo via JOIN em uploaded_images.
 * Retorna null se o usuário não tiver QR code salvo.
 */
async function findByUserId(userId) {
  const result = await database.query({
    text: `
      SELECT
        q.id,
        q.fg_color,
        q.bg_color,
        q.logo_size,
        i.secure_url AS logo_url
      FROM qr_codes q
      LEFT JOIN uploaded_images i ON i.id = q.logo_image_id
      WHERE q.id = (SELECT qr_code_id FROM users WHERE id = $1)
    `,
    values: [userId],
  });
  return result.rows[0] ?? null;
}

/**
 * Cria ou atualiza o QR code do usuário.
 * Se um logoFile for fornecido, faz upload e associa à linha.
 *
 * @param {string} userId
 * @param {{ fgColor: string, bgColor: string, logoSize: number, logoFile?: File|Blob|null }} options
 * @returns {Promise<object>} linha salva (sem logo_url — buscar com findByUserId se necessário)
 */
async function upsertForUser(userId, { fgColor, bgColor, logoSize, logoFile }) {
  let logoImageId = null;
  if (logoFile) {
    const imageData = await uploadedImages.uploadImage(
      logoFile,
      `users/${userId}/qr_logo`,
    );
    logoImageId = imageData.id;
  }

  const existing = await database.query({
    text: `SELECT qr_code_id FROM users WHERE id = $1`,
    values: [userId],
  });
  const existingQrId = existing.rows[0]?.qr_code_id ?? null;

  if (existingQrId) {
    const values = [existingQrId, fgColor, bgColor, logoSize];
    const extraSet = logoImageId
      ? `, logo_image_id = $${values.length + 1}`
      : "";
    if (logoImageId) values.push(logoImageId);

    const result = await database.query({
      text: `
        UPDATE qr_codes
        SET
          fg_color   = $2,
          bg_color   = $3,
          logo_size  = $4,
          updated_at = timezone('utc', now())
          ${extraSet}
        WHERE id = $1
        RETURNING *
      `,
      values,
    });
    return result.rows[0];
  }

  const insertValues = [fgColor, bgColor, logoSize];
  const insertColumns = ["fg_color", "bg_color", "logo_size"];
  const insertPlaceholders = ["$1", "$2", "$3"];
  if (logoImageId) {
    insertColumns.push("logo_image_id");
    insertPlaceholders.push(`$${insertValues.length + 1}`);
    insertValues.push(logoImageId);
  }

  const insertResult = await database.query({
    text: `
      INSERT INTO qr_codes (${insertColumns.join(", ")})
      VALUES (${insertPlaceholders.join(", ")})
      RETURNING *
    `,
    values: insertValues,
  });
  const newQr = insertResult.rows[0];

  await database.query({
    text: `UPDATE users SET qr_code_id = $1 WHERE id = $2`,
    values: [newQr.id, userId],
  });

  return newQr;
}

const qrCode = {
  findByUserId,
  upsertForUser,
  findByOrganizationId,
  upsertForOrganization,
};
export default qrCode;

// ─────────────────────────────────────────────────────────────
// Organizations (estúdios)
// ─────────────────────────────────────────────────────────────

async function findByOrganizationId(orgId) {
  const result = await database.query({
    text: `
      SELECT
        q.id,
        q.fg_color,
        q.bg_color,
        q.logo_size,
        i.secure_url AS logo_url
      FROM qr_codes q
      LEFT JOIN uploaded_images i ON i.id = q.logo_image_id
      WHERE q.id = (SELECT qr_code_id FROM organizations WHERE id = $1)
    `,
    values: [orgId],
  });
  return result.rows[0] ?? null;
}

async function upsertForOrganization(
  orgId,
  { fgColor, bgColor, logoSize, logoFile },
) {
  let logoImageId = null;
  if (logoFile) {
    const imageData = await uploadedImages.uploadImage(
      logoFile,
      `organizations/${orgId}/qr_logo`,
    );
    logoImageId = imageData.id;
  }

  const existing = await database.query({
    text: `SELECT qr_code_id FROM organizations WHERE id = $1`,
    values: [orgId],
  });
  const existingQrId = existing.rows[0]?.qr_code_id ?? null;

  if (existingQrId) {
    const values = [existingQrId, fgColor, bgColor, logoSize];
    const extraSet = logoImageId
      ? `, logo_image_id = $${values.length + 1}`
      : "";
    if (logoImageId) values.push(logoImageId);

    const result = await database.query({
      text: `
        UPDATE qr_codes
        SET
          fg_color   = $2,
          bg_color   = $3,
          logo_size  = $4,
          updated_at = timezone('utc', now())
          ${extraSet}
        WHERE id = $1
        RETURNING *
      `,
      values,
    });
    return result.rows[0];
  }

  const insertValues = [fgColor, bgColor, logoSize];
  const insertColumns = ["fg_color", "bg_color", "logo_size"];
  const insertPlaceholders = ["$1", "$2", "$3"];
  if (logoImageId) {
    insertColumns.push("logo_image_id");
    insertPlaceholders.push(`$${insertValues.length + 1}`);
    insertValues.push(logoImageId);
  }

  const insertResult = await database.query({
    text: `
      INSERT INTO qr_codes (${insertColumns.join(", ")})
      VALUES (${insertPlaceholders.join(", ")})
      RETURNING *
    `,
    values: insertValues,
  });
  const newQr = insertResult.rows[0];

  await database.query({
    text: `UPDATE organizations SET qr_code_id = $1 WHERE id = $2`,
    values: [newQr.id, orgId],
  });

  return newQr;
}
