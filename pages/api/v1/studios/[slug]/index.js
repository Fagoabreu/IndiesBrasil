import { createRouter } from "next-connect";
import controller from "infra/controller";
import authorization from "models/authorization";
import organization from "models/organization";
import { ForbiddenError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:studio"), getHandler)
  .patch(controller.canRequest("update:studio"), updateHandler)
  .delete(controller.canRequest("delete:studio"), deleteHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;

  const studio = await organization.findBySlug(slug);

  const isFollowing = requestUser.id ? await organization.isFollowing(studio.id, requestUser.id) : false;
  const isMember = requestUser.id ? await organization.isMember(studio.id, requestUser.id) : false;
  const isAdmin = requestUser.id ? await organization.isAdmin(studio.id, requestUser.id) : false;
  const isOwner = requestUser.id === studio.owner_id;
  const pendingInvitation = requestUser.id && !isMember ? await organization.findPendingInvitationForUser(studio.id, requestUser.id) : null;
  const members = await organization.findMembers(studio.id);
  const contacts = await organization.findContacts(studio.id);

  // Agrupar campos de endereço em objeto aninhado (vêm como colunas planas do JOIN)
  const { street, number, complement, neighborhood, city, state, zip_code, country, ...studioData } = studio;
  const address =
    city || street
      ? {
          street,
          number,
          complement,
          neighborhood,
          city,
          state,
          zip_code,
          country,
        }
      : null;

  return response.status(200).json({
    ...studioData,
    address,
    contacts,
    members,
    viewer: { isFollowing, isMember, isAdmin, isOwner, pendingInvitation },
  });
}

async function updateHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;

  const studio = await organization.findBySlug(slug);

  const canEdit = studio.owner_id === requestUser.id || (await organization.isAdmin(studio.id, requestUser.id));

  if (!canEdit) {
    throw new ForbiddenError({
      message: "Apenas administradores do estúdio podem editar as informações.",
    });
  }

  const raw = await organization.update(slug, request.body);

  // Mesma normalização do getHandler: agrupar campos de endereço
  const { street, number, complement, neighborhood, city, state, zip_code, country, ...studioData } = raw;
  const address =
    city || street
      ? {
          street,
          number,
          complement,
          neighborhood,
          city,
          state,
          zip_code,
          country,
        }
      : null;

  return response.status(200).json({ ...studioData, address });
}

async function deleteHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;

  const studio = await organization.findBySlug(slug);

  if (studio.owner_id !== requestUser.id && !authorization.can(requestUser, "delete:studio")) {
    throw new ForbiddenError({
      message: "Apenas o responsável pelo estúdio pode excluí-lo.",
    });
  }

  // Soft delete não implementado: a tabela organizations não possui deleted_at.
  // Ao implementar, adicionar a coluna via migration e usar UPDATE em vez de DELETE.
  return response.status(204).end();
}
