import controller from "@/infra/controller";
import authorization from "@/models/authorization";
import organization from "@/models/organization";
import meeting from "@/models/meeting";
import { ForbiddenError, NotFoundError } from "@/infra/errors";

/**
 * DELETE /api/v1/studios/[slug]/meetings/[code]/guest-keys/[keyId]
 * Revoga um link de convite (host/admin/owner).
 */
export async function DELETE(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "update:meeting")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para revogar convites de reunião.",
      });
    }

    const { slug, code, keyId } = await params;
    const studio = await organization.findBySlug(slug);
    const found = await meeting.findByCode(code);
    if (found.org_id !== studio.id) throw new NotFoundError({ message: "Reunião não encontrada." });

    const isAdmin = await organization.isAdmin(studio.id, user.id);
    const isOwner = organization.isOwner(studio, user.id);
    const isHost = found.created_by === user.id;
    if (!isHost && !isAdmin && !isOwner) {
      throw new ForbiddenError({
        message: "Apenas o organizador ou administradores do estúdio podem revogar convites.",
      });
    }

    const revoked = await meeting.revokeGuestKey(keyId, found.id);
    return Response.json(revoked, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
