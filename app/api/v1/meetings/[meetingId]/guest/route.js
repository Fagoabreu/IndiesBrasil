import meeting from "@/models/meeting";
import controller from "@/infra/controller";
import galene from "@/lib/galene";
import { ValidationError } from "@/infra/errors";

/**
 * POST /api/v1/meetings/[meetingId]/guest
 * Valida o código temporário de um convidado EXTERNO (sem sessão).
 * Body: { code: string, name?: string }
 * Quando válido, provisiona o grupo no Galene (authKeys) e emite um JWT de
 * acesso restrito (permissões de convidado) com a URL de entrada da sala.
 */
export async function POST(request, { params }) {
  try {
    const { meetingId } = await params;

    let data = {};
    try {
      data = await request.json();
    } catch {
      data = {};
    }

    if (!data.code || typeof data.code !== "string") {
      throw new ValidationError({
        message: "Informe o código de convidado.",
      });
    }

    const found = await meeting.validateGuestCode(meetingId, data.code);

    await galene.ensureRoomProvisioned(found.room_id);
    const access = await galene.createJoinTokenAndUrl({
      roomId: found.room_id,
      username: data.name,
      permissions: galene.GALENE_PERMISSIONS.guest,
      endsAt: found.ends_at,
      codeExpiresAt: found.guest_code_expires_at,
    });

    const publicMeeting = { ...found };
    delete publicMeeting.room_id;

    return Response.json({ meeting: publicMeeting, joinUrl: access.joinUrl, expires_at: access.expiresAt }, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
