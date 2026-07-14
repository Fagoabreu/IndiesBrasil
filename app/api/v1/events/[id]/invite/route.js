import event from "@/models/event";
import controller from "@/infra/controller";
import { ForbiddenError } from "@/infra/errors";
import authorization from "@/models/authorization";
import user from "@/models/user";

/**
 * POST /api/v1/events/[id]/invite
 * Body: { username: string }
 * Convida um usuário para um evento privado (somente organizador).
 */
export async function POST(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const currentUser = request.context.user;

    if (!authorization.can(currentUser, "create:event")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para convidar usuários.",
      });
    }

    const { id } = await params;
    const { username } = await request.json();

    const targetUser = await user.findOneByUsername(username);
    await event.invite(id, targetUser.id, currentUser.id);

    return Response.json({ invited: username }, { status: 201 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

/**
 * PATCH /api/v1/events/[id]/invite
 * Body: { status: 'accepted' | 'declined' }
 * Responde ao convite (o próprio usuário convidado).
 */
export async function PATCH(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const currentUser = request.context.user;

    if (!authorization.can(currentUser, "create:event")) {
      throw new ForbiddenError({
        message: "Você precisa estar logado para responder convites.",
      });
    }

    const { id } = await params;
    const { status } = await request.json();
    await event.respondInvitation(id, currentUser.id, status);

    return Response.json({ status }, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
