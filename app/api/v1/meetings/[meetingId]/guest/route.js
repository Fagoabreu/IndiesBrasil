import meeting from "@/models/meeting";
import controller from "@/infra/controller";
import { ValidationError } from "@/infra/errors";

/**
 * POST /api/v1/meetings/[meetingId]/guest
 * Valida o código temporário de um convidado EXTERNO (sem sessão).
 * Body: { code: string }
 * Retorna os dados públicos da reunião se o código for válido.
 * A emissão do token/URL do Galene acontece na fase de provisionamento.
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

    const publicMeeting = { ...found };
    delete publicMeeting.room_id;

    return Response.json({ meeting: publicMeeting }, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
