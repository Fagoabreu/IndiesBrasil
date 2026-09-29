import controller from "@/infra/controller";
import authorization from "@/models/authorization";
import conversation from "@/models/conversation";
import { ForbiddenError } from "@/infra/errors";

/**
 * GET /api/v1/conversations/unread?party_type=&party_id=
 *
 * Contadores de não lidas da identidade (pessoal por padrão, estúdio quando
 * informado). É o que alimenta o selo da aba de mensagens sem baixar todas as
 * conversas.
 *
 * Feature `read:message`.
 */
export async function GET(request) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "read:message")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para acessar mensagens.",
      });
    }

    const { searchParams } = request.nextUrl;
    const party = await conversation.resolveParty({
      type: searchParams.get("party_type"),
      id: searchParams.get("party_id"),
      userId: user.id,
    });

    const counters = await conversation.countUnreadForParty({ party });

    return Response.json(counters, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
