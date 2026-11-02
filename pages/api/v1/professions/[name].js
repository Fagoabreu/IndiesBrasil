import { createRouter } from "next-connect";
import controller from "infra/controller";
import profession from "models/profession";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .patch(controller.canRequest("read:admin"), patchHandler)
  .delete(controller.canRequest("read:admin"), deleteHandler)
  .handler(controller.errorHandlers);

/**
 * PATCH /api/v1/professions/[name]
 *
 * O nome vem na URL (a tabela usa `name` como chave primária, não `id`).
 * Renomear chega ao perfil de quem já declarou a especialidade pelo
 * `ON UPDATE CASCADE` — ver `models/profession.js`.
 *
 * `is_active: false` é o caminho normal para aposentar uma profissão: ela sai do
 * seletor do perfil e dos filtros mas continua nos perfis que já a tinham.
 */
async function patchHandler(request, response) {
  const name = decodeURIComponent(request.query.name);
  const updated = await profession.update(name, request.body);
  return response.status(200).json(updated);
}

/**
 * DELETE /api/v1/professions/[name]
 *
 * Só quando nenhum perfil usa. Em uso, o model responde 400 com a contagem —
 * cascata removeria a especialidade de quem a declarou sem ninguém pedir (e a
 * FK é `ON DELETE RESTRICT`, então o banco recusaria de qualquer forma).
 */
async function deleteHandler(request, response) {
  const name = decodeURIComponent(request.query.name);
  await profession.deleteProfession(name);
  return response.status(204).end();
}
