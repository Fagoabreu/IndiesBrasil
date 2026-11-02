import { createRouter } from "next-connect";
import controller from "infra/controller";
import organization from "models/organization";
import { ForbiddenError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("update:studio"), getHandler)
  .put(controller.canRequest("update:studio"), putHandler)
  .handler(controller.errorHandlers);

/**
 * Serviços declarados pelo estúdio.
 *
 * Mesma regra dos contatos: só o responsável ou um administrador do estúdio
 * mexe. O gate de feature (`update:studio`) é a primeira barreira; esta é a que
 * vale para o estúdio específico do endereço.
 */
async function assertCanEdit(studio, requestUser) {
  const isAdmin = await organization.isAdmin(studio.id, requestUser.id);
  if (!isAdmin && studio.owner_id !== requestUser.id) {
    throw new ForbiddenError({
      message: "Apenas administradores do estúdio podem gerenciar os serviços.",
    });
  }
}

async function getHandler(request, response) {
  const { slug } = request.query;
  const studio = await organization.findBySlug(slug);
  await assertCanEdit(studio, request.context.user);

  const services = await organization.findServices(studio.id);
  return response.status(200).json(services);
}

/**
 * PUT /api/v1/studios/[slug]/services
 *
 * Body: `{ services: [{ service_id, summary?, price?, price_note? }] }`
 *
 * Substitui a lista inteira, e não item a item: o formulário é uma grade de
 * checkboxes, e um POST/DELETE por clique geraria estados intermediários
 * inválidos (o `MAX_STUDIO_SERVICES` seria ultrapassado e desfeito no clique
 * seguinte).
 */
async function putHandler(request, response) {
  const { slug } = request.query;
  const studio = await organization.findBySlug(slug);
  await assertCanEdit(studio, request.context.user);

  const services = await organization.setServices(studio.id, request.body?.services);
  return response.status(200).json(services);
}
