import database from "infra/database";
import { NotFoundError } from "infra/errors";
import address from "./address.js";

const { validate, normalizeZip } = address;

/* ================================================================
 * Consultas
 * ================================================================ */

const ADDRESS_SELECT = `
  a.id          AS address_id,
  a.street,
  a.number,
  a.complement,
  a.neighborhood,
  a.city,
  a.state,
  a.zip_code,
  a.country,
  ua.id         AS user_address_id,
  ua.label,
  ua.is_default,
  ua.created_at
`;

/**
 * Lista todos os endereços salvos de um usuário (padrão primeiro).
 * @param {string} userId
 * @returns {Promise<Array<object>>}
 */
async function findByUserId(userId) {
  const result = await database.query({
    text: `
      SELECT ${ADDRESS_SELECT}
      FROM user_addresses ua
      JOIN addresses a ON a.id = ua.address_id
      WHERE ua.user_id = $1
      ORDER BY ua.is_default DESC, ua.created_at ASC
    `,
    values: [userId],
  });

  return result.rows;
}

/**
 * Busca um endereço salvo de um usuário (com checagem de posse).
 * @param {string} addressId
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function findForUser(addressId, userId) {
  const result = await database.query({
    text: `
      SELECT ${ADDRESS_SELECT}
      FROM user_addresses ua
      JOIN addresses a ON a.id = ua.address_id
      WHERE ua.address_id = $1 AND ua.user_id = $2
    `,
    values: [addressId, userId],
  });

  if (!result.rows[0]) {
    throw new NotFoundError({ message: "Endereço não encontrado." });
  }

  return result.rows[0];
}

/* ================================================================
 * Mutação
 * ================================================================ */

/**
 * Cria um endereço e o vincula ao usuário. O primeiro endereço do usuário
 * (ou `isDefault`) vira o padrão automaticamente.
 * @param {string} userId
 * @param {object} data Campos do endereço
 * @param {{ label?: string, isDefault?: boolean }} [options]
 * @returns {Promise<object>}
 */
async function createForUser(userId, data, { label = null, isDefault = false } = {}) {
  validate(data);

  const addressId = await database.transaction(async (client) => {
    const created = await client.query({
      text: `
        INSERT INTO addresses
          (street, number, complement, neighborhood, city, state, zip_code, country)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
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

    const countResult = await client.query({
      text: "SELECT COUNT(*)::int AS total FROM user_addresses WHERE user_id = $1",
      values: [userId],
    });

    const isFirst = countResult.rows[0].total === 0;
    const makeDefault = isFirst || isDefault;

    if (makeDefault) {
      await client.query({
        text: "UPDATE user_addresses SET is_default = false WHERE user_id = $1",
        values: [userId],
      });
    }

    await client.query({
      text: `
        INSERT INTO user_addresses (user_id, address_id, label, is_default)
        VALUES ($1, $2, $3, $4)
      `,
      values: [userId, created.rows[0].id, label?.trim() || null, makeDefault],
    });

    return created.rows[0].id;
  });

  return findForUser(addressId, userId);
}

/**
 * Atualiza o endereço e/ou o rótulo e a condição de padrão.
 * @param {string} addressId
 * @param {string} userId
 * @param {object} data
 * @returns {Promise<object>}
 */
async function updateForUser(addressId, userId, data) {
  const { label, is_default: isDefault, ...addressData } = data;

  const hasAddressFields = Object.keys(addressData).some((key) => addressData[key] !== undefined);

  await database.transaction(async (client) => {
    const owned = await client.query({
      text: "SELECT 1 FROM user_addresses WHERE address_id = $1 AND user_id = $2",
      values: [addressId, userId],
    });

    if (!owned.rows[0]) {
      throw new NotFoundError({ message: "Endereço não encontrado." });
    }

    if (hasAddressFields) {
      validate(addressData);

      await client.query({
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
        `,
        values: [
          addressData.street?.trim() || null,
          addressData.number?.trim() || null,
          addressData.complement?.trim() || null,
          addressData.neighborhood?.trim() || null,
          addressData.city.trim(),
          addressData.state.trim().toUpperCase().slice(0, 2),
          normalizeZip(addressData.zip_code),
          addressData.country?.trim() || "Brasil",
          addressId,
        ],
      });
    }

    if (label !== undefined) {
      await client.query({
        text: "UPDATE user_addresses SET label = $1 WHERE address_id = $2 AND user_id = $3",
        values: [label?.trim() || null, addressId, userId],
      });
    }

    if (isDefault === true) {
      await client.query({
        text: "UPDATE user_addresses SET is_default = false WHERE user_id = $1",
        values: [userId],
      });

      await client.query({
        text: "UPDATE user_addresses SET is_default = true WHERE address_id = $1 AND user_id = $2",
        values: [addressId, userId],
      });
    }
  });

  return findForUser(addressId, userId);
}

/**
 * Remove o vínculo e o endereço em si.
 * @param {string} addressId
 * @param {string} userId
 * @returns {Promise<string>} addressId removido
 */
async function removeForUser(addressId, userId) {
  await database.transaction(async (client) => {
    const removed = await client.query({
      text: "DELETE FROM user_addresses WHERE address_id = $1 AND user_id = $2 RETURNING address_id",
      values: [addressId, userId],
    });

    if (!removed.rows[0]) {
      throw new NotFoundError({ message: "Endereço não encontrado." });
    }

    await client.query({
      text: "DELETE FROM addresses WHERE id = $1",
      values: [addressId],
    });
  });

  return addressId;
}

/**
 * Define um endereço como padrão do usuário.
 * @param {string} userId
 * @param {string} addressId
 * @returns {Promise<object>}
 */
async function setDefault(userId, addressId) {
  await database.transaction(async (client) => {
    const owned = await client.query({
      text: "SELECT 1 FROM user_addresses WHERE address_id = $1 AND user_id = $2",
      values: [addressId, userId],
    });

    if (!owned.rows[0]) {
      throw new NotFoundError({ message: "Endereço não encontrado." });
    }

    await client.query({
      text: "UPDATE user_addresses SET is_default = false WHERE user_id = $1",
      values: [userId],
    });

    await client.query({
      text: "UPDATE user_addresses SET is_default = true WHERE address_id = $1 AND user_id = $2",
      values: [addressId, userId],
    });
  });

  return findForUser(addressId, userId);
}

const userAddress = {
  findByUserId,
  findForUser,
  createForUser,
  updateForUser,
  removeForUser,
  setDefault,
};

export default userAddress;
