import database from "infra/database";
import { NotFoundError, ValidationError } from "@/infra/errors";

/* ================================================================
 * VALIDATION
 * ================================================================ */

function validate(data) {
  if (!data.city?.trim()) {
    throw new ValidationError({ message: "Cidade é obrigatória no endereço." });
  }
  if (!data.state?.trim()) {
    throw new ValidationError({
      message: "Estado (UF) é obrigatório no endereço.",
    });
  }
}

function normalizeZip(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  return digits.slice(0, 8) || null;
}

/* ================================================================
 * CRUD
 * ================================================================ */

/**
 * Cria um novo registro de endereço.
 * @param {object} data
 * @returns {Promise<object>} Endereço criado
 */
async function create(data) {
  validate(data);

  const result = await database.query({
    text: `
      INSERT INTO addresses
        (street, number, complement, neighborhood, city, state, zip_code, country)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    values: [
      data.street?.trim() || null,
      data.number?.trim() || null,
      data.complement?.trim() || null,
      data.neighborhood?.trim() || null,
      data.city.trim(),
      data.state.trim().toUpperCase().slice(0, 2),
      normalizeZip(data.zip_code),
      data.country?.trim() || "Brasil",
    ],
  });

  return result.rows[0];
}

/**
 * Atualiza todos os campos de um endereço existente.
 * @param {string} id UUID do endereço
 * @param {object} data
 * @returns {Promise<object>} Endereço atualizado
 */
async function update(id, data) {
  validate(data);

  const result = await database.query({
    text: `
      UPDATE addresses
      SET
        street       = $1,
        number       = $2,
        complement   = $3,
        neighborhood = $4,
        city         = $5,
        state        = $6,
        zip_code     = $7,
        country      = $8,
        updated_at   = NOW()
      WHERE id = $9
      RETURNING *
    `,
    values: [
      data.street?.trim() || null,
      data.number?.trim() || null,
      data.complement?.trim() || null,
      data.neighborhood?.trim() || null,
      data.city.trim(),
      data.state.trim().toUpperCase().slice(0, 2),
      normalizeZip(data.zip_code),
      data.country?.trim() || "Brasil",
      id,
    ],
  });

  if (!result.rowCount) {
    throw new NotFoundError({ message: "Endereço não encontrado." });
  }

  return result.rows[0];
}

/**
 * Remove um endereço pelo ID.
 * @param {string} id UUID do endereço
 */
async function remove(id) {
  await database.query({
    text: "DELETE FROM addresses WHERE id = $1",
    values: [id],
  });
}

const addressModel = { create, update, remove };
export default addressModel;
