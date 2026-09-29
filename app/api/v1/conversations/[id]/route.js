import controller from "@/infra/controller";
import authorization from "@/models/authorization";
import conversation from "@/models/conversation";
import rateLimit from "@/lib/rate-limit";
import { ForbiddenError, ValidationError } from "@/infra/errors";

/**
 * GET /api/v1/conversations/[id]?party_type=&party_id=&limit=
 *
 * Carga inicial da conversa: a página mais recente de mensagens e os dados de
 * exibição do outro lado. **Marca como lida** — é o efeito colateral esperado
 * de abrir uma caixa de entrada, e fazê-lo aqui evita uma segunda ida ao
 * servidor só para registrar a leitura.
 *
 * Feature `read:message`.
 */
export async function GET(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "read:message")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para acessar mensagens.",
      });
    }

    const { id } = await params;
    const { searchParams } = request.nextUrl;
    const party = await conversation.resolveParty({
      type: searchParams.get("party_type"),
      id: searchParams.get("party_id"),
      userId: user.id,
    });

    const detail = await conversation.findForParty({ conversationId: id, party });
    const page = await conversation.listMessages({
      conversationId: id,
      party,
      before: searchParams.get("before"),
      limit: searchParams.get("limit"),
    });
    const reads = await conversation.markRead({ conversationId: id, party });

    return Response.json({ ...page, conversation: detail, muted: reads.muted }, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

/**
 * POST /api/v1/conversations/[id]
 * Body (JSON): { body, party_type?, party_id? }
 *
 * Envia uma mensagem na conversa. Quando `party_type=studio`, a mensagem sai em
 * nome do estúdio — e o humano que digitou continua gravado em
 * `messages.sent_by_user_id` (rastro para a moderação).
 *
 * Feature `create:message`.
 */
export async function POST(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "create:message")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para enviar mensagens.",
      });
    }

    // Duas janelas: rajada (30/min) e volume no dia (200/dia). A chave é o
    // usuário, não o IP — a conta é que abusa, e o IP puniria o NAT inteiro.
    controller.rateLimitRequest({ limiter: rateLimit.limiters.messages, request, keyBy: () => user.id });
    controller.rateLimitRequest({ limiter: rateLimit.limiters.messagesDaily, request, keyBy: () => user.id });

    const { searchParams } = request.nextUrl;
    const payload = await request.json().catch(() => null);
    if (!payload) {
      throw new ValidationError({
        message: "Corpo da requisição inválido.",
        action: "Envie { body } em JSON.",
      });
    }

    const { id } = await params;
    const party = await conversation.resolveParty({
      type: payload.party_type ?? searchParams.get("party_type"),
      id: payload.party_id ?? searchParams.get("party_id"),
      userId: user.id,
    });

    const sent = await conversation.sendMessage({ conversationId: id, party, body: payload.body });

    return Response.json(sent, { status: 201 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

/**
 * PATCH /api/v1/conversations/[id]
 * Body (JSON): { muted: boolean, party_type?, party_id? }
 *
 * Silencia ou reativa as notificações da conversa para a parte. Não esconde a
 * conversa: ela segue na listagem com o contador de não lidas.
 *
 * Feature `read:message`.
 */
export async function PATCH(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "read:message")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para alterar mensagens.",
      });
    }

    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload.muted !== "boolean") {
      throw new ValidationError({
        message: "Corpo da requisição inválido.",
        action: "Envie { muted: true | false } em JSON.",
      });
    }

    const { id } = await params;
    const party = await conversation.resolveParty({
      type: payload.party_type,
      id: payload.party_id,
      userId: user.id,
    });

    const reads = await conversation.setMuted({ conversationId: id, party, muted: payload.muted });

    return Response.json({ muted: reads.muted }, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
