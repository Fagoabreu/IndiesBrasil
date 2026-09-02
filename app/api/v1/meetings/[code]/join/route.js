import controller from "@/infra/controller";
import moderation from "@/models/moderation";
import meeting from "@/models/meeting";
import organization from "@/models/organization";
import livekit from "@/lib/livekit";
import sanitizeHtml from "@/lib/sanitize";
import { ForbiddenError, NotFoundError, ValidationError } from "@/infra/errors";

const MAX_GUEST_NAME_LENGTH = 60;

/**
 * Verifica se a reunião aceita participantes no momento:
 * ativa OU agendada cujo horário já chegou.
 */
function assertJoinable(meetingRow) {
  if (meetingRow.status === "cancelled") {
    throw new ValidationError({ message: "Esta reunião foi cancelada." });
  }
  if (meetingRow.status === "ended") {
    throw new ValidationError({ message: "Esta reunião já foi encerrada." });
  }

  const started = meetingRow.status === "active" || (meetingRow.status === "scheduled" && new Date(meetingRow.starts_at).getTime() <= Date.now());

  if (!started) {
    throw new ValidationError({
      message: "A reunião ainda não começou.",
      action: "Aguarde o horário marcado ou a abertura pelo organizador.",
    });
  }
}

function sanitizeGuestName(rawName) {
  if (rawName === undefined || rawName === null) return null;
  const clean = sanitizeHtml.sanitize(String(rawName)).trim();
  if (!clean) return null;
  if (clean.length > MAX_GUEST_NAME_LENGTH) {
    throw new ValidationError({
      message: "Nome muito longo.",
      action: `Use no máximo ${MAX_GUEST_NAME_LENGTH} caracteres.`,
    });
  }
  return clean;
}

/**
 * POST /api/v1/meetings/[code]/join
 * Entra na reunião:
 *  - membro do estúdio → token direto (sem body);
 *  - convidado com link → body { invite_token, name? }.
 * Retorna o token LiveKit + dados de conexão (server_url, room).
 */
export async function POST(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;
    const isAuthenticated = Boolean(user?.id);

    const { code } = await params;
    const meetingRow = await meeting.findByCode(code);

    const isBlocked = await moderation.isBlocked("meeting", meetingRow.id);
    if (isBlocked) {
      throw new ForbiddenError({
        message: "Esta reunião foi bloqueada pela moderação.",
        action: "Entre em contato com o suporte se tiver dúvidas.",
      });
    }

    const org = await organization.findById(meetingRow.org_id);
    const body = await request.json().catch(() => ({}));

    const isHost = meetingRow.created_by === user?.id;
    const isMember =
      isAuthenticated &&
      (isHost ||
        (await organization.isMember(org.id, user.id)) ||
        (await organization.isAdmin(org.id, user.id)) ||
        organization.isOwner(org, user.id));

    let identity;
    let name;
    let metadata;

    if (isMember) {
      // Caminho membro: identificado pelo usuário autenticado.
      identity = `u:${user.id}`;
      name = user.username;
      metadata = JSON.stringify({ kind: "member", org_slug: org.slug, org_id: org.id });
    } else {
      // Caminho convidado: exige link de convite válido.
      const inviteToken = body.invite_token;
      if (!inviteToken?.trim()) {
        throw new ForbiddenError({
          message: "Esta reunião é restrita aos membros do estúdio.",
          action: "Entre usando o link de convite enviado pelo organizador.",
        });
      }

      const guestKey = await meeting.findValidGuestKeyByToken(inviteToken);
      if (guestKey.meeting_code !== meetingRow.code) {
        throw new NotFoundError({
          message: "Este link de convite não pertence a esta reunião.",
        });
      }
      if (guestKey.meeting_status === "ended" || guestKey.meeting_status === "cancelled") {
        throw new ValidationError({ message: "Esta reunião foi encerrada ou cancelada." });
      }

      await meeting.markGuestKeyUsed(guestKey.id);
      identity = `g:${guestKey.id}`;
      metadata = JSON.stringify({ kind: "guest", guest_key_id: guestKey.id, org_slug: org.slug });

      const cleanName = sanitizeGuestName(body.name);
      if (isAuthenticated) {
        name = cleanName || user.username || "Convidado";
      } else {
        name = cleanName || "Convidado";
      }
    }

    // Bloqueio de horário/status é verificado após autenticar o acesso
    // para dar mensagens precisas a cada perfil.
    assertJoinable(meetingRow);

    const token = await livekit.createMeetingToken({
      identity,
      name,
      room: meetingRow.code,
      metadata,
    });

    return Response.json(
      {
        token,
        server_url: livekit.getServerUrl(),
        room: meetingRow.code,
        identity,
        mode: isMember ? "member" : "guest",
        meeting: {
          code: meetingRow.code,
          title: meetingRow.title,
          status: meetingRow.status,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
