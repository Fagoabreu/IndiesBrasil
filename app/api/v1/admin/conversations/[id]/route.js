import controller from "@/infra/controller";
import authorization from "@/models/authorization";
import conversation from "@/models/conversation";
import { ForbiddenError } from "@/infra/errors";

/**
 * GET /api/v1/admin/conversations/[id]?limit=&before=
 *
 * Leitura de uma conversa denunciada, para a moderação julgar a denúncia.
 *
 * Exige `read:admin` — o mesmo recurso de todas as rotas de moderação do
 * projeto (`/api/v1/reports`, `/api/v1/moderation`), e o que o script
 * `infra/scripts/promote-admin.js` realmente concede. Um recurso dedicado
 * ("read:conversation:any") não seria concedido a ninguém e esta rota ficaria
 * morta com 403 para todo mundo — implementada no papel, inacessível na prática.
 *
 * O nome `read:admin` é genérico de propósito: o acesso é limitado pelo que a
 * rota oferece (uma conversa, por `id`), não pelo recurso. Não existe rota que
 * liste todas as conversas da plataforma.
 *
 * Somente leitura: não há POST aqui. Congelar a conversa é uma ação de
 * moderação normal, via `POST /api/v1/moderation` com
 * `target_type = "conversation"`.
 */
export async function GET(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "read:admin")) {
      throw new ForbiddenError({
        message: "Acesso restrito à moderação.",
        action: "Você não possui permissão para ler conversas denunciadas.",
      });
    }

    const { id } = await params;
    const { searchParams } = request.nextUrl;

    const detail = await conversation.describeForModeration(id);
    const page = await conversation.listMessagesForModeration({
      conversationId: id,
      before: searchParams.get("before"),
      limit: searchParams.get("limit"),
    });

    return Response.json({ ...page, conversation: detail }, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
