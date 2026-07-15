import { createRouter } from "next-connect";
import controller from "infra/controller";
import organization from "models/organization";
import { ForbiddenError, ValidationError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("update:studio"), listHandler)
  .post(controller.canRequest("update:studio"), createHandler)
  .handler(controller.errorHandlers);

async function assertCanEdit(studio, requestUser) {
  const isAdmin = await organization.isAdmin(studio.id, requestUser.id);
  if (!isAdmin && studio.owner_id !== requestUser.id) {
    throw new ForbiddenError({
      message: "Apenas administradores do estúdio podem gerenciar contatos.",
    });
  }
}

async function listHandler(request, response) {
  const { slug } = request.query;
  const studio = await organization.findBySlug(slug);
  await assertCanEdit(studio, request.context.user);
  const contacts = await organization.findContacts(studio.id);
  return response.status(200).json(contacts);
}

async function createHandler(request, response) {
  const { slug } = request.query;
  const studio = await organization.findBySlug(slug);
  await assertCanEdit(studio, request.context.user);

  const { contact_type_id, contact_value } = request.body;
  if (!contact_type_id || !contact_value?.trim()) {
    throw new ValidationError({
      message: "Tipo e valor do contato são obrigatórios.",
    });
  }

  const contact = await organization.createContact(studio.id, contact_type_id, contact_value);
  return response.status(201).json(contact);
}
