import organization from "@/models/organization";
import controller from "@/infra/controller";
import { ForbiddenError } from "@/infra/errors";
import authorization from "@/models/authorization";

/**
 * PATCH /api/v1/studios/[slug]/relationships/[id]
 * Body: { action: 'accept' | 'reject' }
 * Responde a uma solicitação de relacionamento recebida.
 * Requer que o usuário seja admin/dono do estúdio [slug] e que esse estúdio
 * seja o RECEPTOR da solicitação.
 */
export async function PATCH(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "create:studio")) {
      throw new ForbiddenError({ message: "Você precisa estar logado." });
    }

    const { slug, id } = await params;
    const { action } = await request.json();

    const studio = await organization.findBySlug(slug);

    const isAdminOrOwner = (await organization.isAdmin(studio.id, user.id)) || (await organization.isOwner(studio.id, user.id));
    if (!isAdminOrOwner) {
      throw new ForbiddenError({ message: "Apenas administradores do estúdio podem responder solicitações de relacionamento." });
    }

    const rel = await organization.respondToRelationship(id, studio.id, user.id, action);

    return Response.json(rel, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

/**
 * DELETE /api/v1/studios/[slug]/relationships/[id]
 * Remove um relacionamento existente.
 * Requer que o usuário seja admin/dono do estúdio [slug].
 */
export async function DELETE(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "create:studio")) {
      throw new ForbiddenError({ message: "Você precisa estar logado." });
    }

    const { slug, id } = await params;

    const studio = await organization.findBySlug(slug);

    const isAdminOrOwner = (await organization.isAdmin(studio.id, user.id)) || (await organization.isOwner(studio.id, user.id));
    if (!isAdminOrOwner) {
      throw new ForbiddenError({ message: "Apenas administradores do estúdio podem encerrar relacionamentos." });
    }

    await organization.removeRelationship(id, studio.id);

    return new Response(null, { status: 204 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
