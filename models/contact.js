import database from "infra/database";
import { ValidationError } from "infra/errors";
import { normalizeContactValue } from "lib/contactTypes";

async function createType(userInputValues) {
  const createdContactType = await runInsertQuery(userInputValues);
  return createdContactType;

  async function runInsertQuery(userInputValues) {
    const results = await database.query({
      text: `
      Insert into
        contact_type (icon_key,icon_img)
      values
        ($1,$2)
      returning
        *`,
      values: [userInputValues.icon_key, userInputValues.icon_img],
    });
    return results.rows[0];
  }
}

async function findAllType() {
  const contactType = await runSelectQuery();
  return contactType;

  async function runSelectQuery() {
    const results = await database.query({
      text: `
      select
        id,
        icon_key,
        icon_img
      from
        contact_type
        `,
    });
    return results.rows;
  }
}

/**
 * Busca um tipo de contato por id, ou `null`.
 *
 * Usado na gravação de contato: o formulário manda `contact_type_id`, mas a
 * normalização do valor depende do `icon_key` (é ele que diz se o valor é
 * telefone, @usuario ou URL). Fica aqui — e não numa consulta solta na rota —
 * porque as duas rotas de contato (perfil e estúdio) precisam do mesmo.
 * @param {number|string} id
 * @returns {Promise<{ id: number, icon_key: string, icon_img: string }|null>}
 */
async function findTypeById(id) {
  const results = await database.query({
    text: `
      select
        id,
        icon_key,
        icon_img
      from
        contact_type
      where
        id = $1
      limit
        1`,
    values: [id],
  });

  return results.rows[0] ?? null;
}

async function deleteType(id) {
  const deletedContactType = await runDeleteQuery(id);
  return deletedContactType;

  async function runDeleteQuery(id) {
    const results = await database.query({
      text: `
      delete from
        contact_type
      where id=$1
      returning
        *`,
      values: [id],
    });
    return results.rows[0];
  }
}

/**
 * Resolve o tipo informado e devolve o valor na forma canônica gravada.
 *
 * Ponto único de normalização na escrita, compartilhado pelas três rotas que
 * criam contato (perfil, perfil por id e estúdio). Antes cada uma só conferia
 * `!value.trim()`, então `@usuario` e telefone sem formato entravam no banco como
 * o usuário digitou e não viravam link.
 *
 * @param {{ contact_type_id: number|string, contact_value: string }} input
 * @returns {Promise<{ icon_key: string, value: string }>}
 * @throws {ValidationError} tipo inexistente ou valor inválido para o tipo.
 */
async function resolveValue({ contact_type_id: contactTypeId, contact_value: rawValue }) {
  if (!contactTypeId) {
    throw new ValidationError({ message: "Escolha o tipo do contato." });
  }

  const type = await findTypeById(contactTypeId);
  if (!type) {
    throw new ValidationError({
      message: "Tipo de contato não encontrado.",
      action: "Escolha um dos tipos disponíveis na lista.",
    });
  }

  const result = normalizeContactValue(type.icon_key, rawValue);
  if (!result.ok) {
    throw new ValidationError({ message: result.reason });
  }

  return { icon_key: type.icon_key, value: result.value };
}

const contact = {
  createType,
  findAllType,
  findTypeById,
  resolveValue,
  deleteType,
};

export default contact;
