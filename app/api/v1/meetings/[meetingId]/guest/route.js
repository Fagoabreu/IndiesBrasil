import meeting from "@/models/meeting";
import controller from "@/infra/controller";
import galene from "@/lib/galene";
import { meetingPageUrl } from "@/lib/meetingFormat";
import { ValidationError } from "@/infra/errors";

/**
 * POST /api/v1/meetings/[meetingId]/guest
 * Valida o código temporário de um convidado EXTERNO (sem sessão).
 * Body: { code: string, name?: string }
 * Quando válido, garante o grupo do ESTÚDIO no Galene (authKeys +
 * `auto-subgroups`) e emite um JWT de acesso restrito (permissões de
 * convidado) com a URL de entrada da sala.
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

    await galene.ensureStudioGroup(found.org_slug, found.org_name);
    const access = await galene.createJoinTokenAndUrl({
      studio: found.org_slug,
      roomId: found.room_id,
      username: data.name,
      // Convidado externo não tem conta: sem avatar. O `back` vale para todos,
      // para o botão de sair levar de volta à página do convite.
      back: meetingPageUrl(found.id),
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
