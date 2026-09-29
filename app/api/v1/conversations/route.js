import controller from "@/infra/controller";
import authorization from "@/models/authorization";
import conversation from "@/models/conversation";
import rateLimit from "@/lib/rate-limit";
import { ForbiddenError, ValidationError } from "@/infra/errors";

/**
 * GET /api/v1/conversations?party_type=&party_id=&scope=
 *
 * Lista as conversas da identidade informada. Sem `party_type`/`party_id` a
 * caixa é a pessoal do usuário autenticado; com `party_type=studio&party_id=…`
 * é a caixa compartilhada do estúdio (exige ser membro ativo).
 *
 * `scope=muted` devolve apenas as silenciadas — é o que torna o silêncio
 * reversível pela interface.
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

    const scope = searchParams.get("scope");
    const conversations = scope === "muted" ? await conversation.listMutedForParty({ party }) : await conversation.listForParty({ party });

    return Response.json(conversations, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

/**
 * POST /api/v1/conversations
 * Body (JSON): { target_type: "user" | "studio", target_id }
 *
 * Abre a conversa do usuário com um membro ou estúdio. É **idempotente**: a
 * ordem canônica do par (garantida por índice único no banco) faz `A → B` e
 * `B → A` caírem na mesma linha, então chamar de novo devolve a mesma conversa
 * em vez de criar uma segunda.
 *
 * Não existe rota equivalente para o estúdio iniciar uma conversa: o estúdio
 * **só responde** (ver `models/conversation.js`).
 *
 * Feature `create:message`.
 */
export async function POST(request) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "create:message")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para enviar mensagens.",
      });
    }

    // Abrir conversa também é um vetor de assédio (varrer a lista de membros).
    controller.rateLimitRequest({ limiter: rateLimit.limiters.messages, request, keyBy: () => user.id });

    const body = await request.json().catch(() => null);
    if (!body) {
      throw new ValidationError({
        message: "Corpo da requisição inválido.",
        action: "Envie { target_type, target_id } em JSON.",
      });
    }

    const created = await conversation.findOrCreateForUser({
      userId: user.id,
      targetType: body.target_type,
      targetId: body.target_id,
    });

    return Response.json({ id: created.id }, { status: 201 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
