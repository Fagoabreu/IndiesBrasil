import controller from "@/infra/controller";
import authorization from "@/models/authorization";
import moderation from "@/models/moderation";
import { ForbiddenError } from "@/infra/errors";

/**
 * DELETE /api/v1/moderation/[id]
 * Revoga um bloqueio ativo. Exclusivo de administradores.
 */
export async function DELETE(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "read:admin")) {
      throw new ForbiddenError({
        message: "Acesso restrito a administradores.",
        action: "Você não possui permissão para revogar moderação.",
      });
    }

    const { id } = await params;

    const revoked = await moderation.revokeBlock(id, user.id);

    return Response.json(revoked, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
