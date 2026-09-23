import meeting from "@/models/meeting";
import controller from "@/infra/controller";
import authorization from "@/models/authorization";
import { ForbiddenError } from "@/infra/errors";

/**
 * GET /api/v1/meetings/mine
 * Query: ?from=&to=
 *
 * Reuniões das organizações do usuário autenticado (responsável ou membro
 * ativo). Não existe variante pública: reunião de estúdio é interna, e
 * `read:meeting` não está na lista do usuário anônimo (ver `injectAnonymousUser`
 * em `infra/controller.js`) — sem sessão a resposta é 403.
 *
 * O filtro por participação vive no SQL (`meeting.findUpcomingByMember`), não
 * aqui: a agenda que consome esta rota é pública, então a seleção é o que
 * protege o dado.
 */
export async function GET(request) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "read:meeting")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para visualizar reuniões.",
      });
    }

    const { searchParams } = request.nextUrl;
    const meetings = await meeting.findUpcomingByMember(user.id, {
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
    });

    return Response.json(
      meetings.map((row) => meeting.serializeMeeting(row)),
      { status: 200 },
    );
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
