import post from "@/models/post";
import controller from "@/infra/controller";
import { ForbiddenError } from "@/infra/errors";
import authorization from "@/models/authorization";

/**
 * GET /api/v1/events/[id]/posts
 * Lista posts vinculados ao evento.
 *
 * Usa `post.getPostsByEventId` — a mesma base de seleção do feed —, e não uma
 * query própria: a versão anterior não trazia `embed`, `comments_count` nem
 * `is_current_user`, então a página do evento não desenhava vídeo, card de link
 * nem enquete, e ainda listava post bloqueado pela moderação.
 */
export async function GET(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "read:event")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para visualizar eventos.",
      });
    }

    const { id } = await params;
    const posts = await post.getPostsByEventId(user.id ?? null, id);
    const secureOutputValues = authorization.filterOutput(user, "read:post:all", posts);

    return Response.json(secureOutputValues, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
