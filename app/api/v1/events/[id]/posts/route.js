import event from "@/models/event";
import controller from "@/infra/controller";
import { ForbiddenError } from "@/infra/errors";
import authorization from "@/models/authorization";

/**
 * GET /api/v1/events/[id]/posts
 * Lista posts vinculados ao evento.
 */
export async function GET(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "read:event")) {
      throw new ForbiddenError({ message: "Você não possui permissão para visualizar eventos." });
    }

    const { id } = await params;
    const posts = await event.getEventPosts(id, user.id ?? null);

    return Response.json(posts, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
