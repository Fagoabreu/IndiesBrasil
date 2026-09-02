import controller from "@/infra/controller";
import authorization from "@/models/authorization";
import moderation from "@/models/moderation";
import meeting from "@/models/meeting";
import livekit from "@/lib/livekit";
import { ForbiddenError, ValidationError } from "@/infra/errors";

/**
 * POST /api/v1/moderation
 * Bloqueia um alvo (post, user, studio, game, boardgame, book).
 * Exclusivo de administradores (`read:admin`).
 * Body (JSON): { target_type, target_id, reason, justification?, expires_at? }
 *   - expires_at (ISO) opcional: null/ausente = bloqueio por tempo indeterminado.
 */
export async function POST(request) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "read:admin")) {
      throw new ForbiddenError({
        message: "Acesso restrito a administradores.",
        action: "Você não possui permissão para aplicar moderação.",
      });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      throw new ValidationError({
        message: "Corpo da requisição inválido.",
        action: "Envie os dados do bloqueio em JSON.",
      });
    }

    const { target_type, target_id, reason, justification, expires_at } = body;

    const block = await moderation.createBlock({
      targetType: target_type,
      targetId: target_id,
      reason,
      justification,
      moderatorId: user.id,
      expiresAt: expires_at,
    });

    // Bloqueio de reunião: encerra a reunião e derruba a sala LiveKit.
    // Falha aqui NÃO deve impedir a resposta — o bloqueio já foi gravado.
    if (target_type === "meeting") {
      try {
        const meetingFound = await meeting.findById(target_id);
        await meeting.endByModeration(meetingFound.code);
        await livekit.closeMeetingRoom(meetingFound.code);
      } catch (roomError) {
        console.error("[moderation] Falha ao encerrar reunião bloqueada:", roomError);
      }
    }

    return Response.json(block, { status: 201 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

/**
 * GET /api/v1/moderation?target_type=
 * Lista bloqueios ativos. Exclusivo de administradores.
 */
export async function GET(request) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "read:admin")) {
      throw new ForbiddenError({
        message: "Acesso restrito a administradores.",
        action: "Você não possui permissão para visualizar moderação.",
      });
    }

    const { searchParams } = request.nextUrl;
    const targetType = searchParams.get("target_type");

    const blocks = await moderation.listBlocks({ targetType });

    return Response.json(blocks, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
