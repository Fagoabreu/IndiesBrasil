import event from "@/models/event";
import controller from "@/infra/controller";
import { ForbiddenError } from "@/infra/errors";
import authorization from "@/models/authorization";

/**
 * POST /api/v1/events/[id]/rsvp
 * Body: { status: 'going' | 'maybe' | 'not_going', instance_id?: string }
 * Confirma ou atualiza presença no evento.
 */
export async function POST(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "create:event")) {
      throw new ForbiddenError({
        message: "Você precisa estar logado para confirmar presença.",
      });
    }

    const { id } = await params;
    const { status, instance_id } = await request.json();

    const counts = await event.upsertRsvp(id, user.id, status, instance_id ?? null);

    return Response.json({ rsvp: status, counts }, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

/**
 * DELETE /api/v1/events/[id]/rsvp
 * Remove a confirmação de presença do usuário.
 */
export async function DELETE(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "create:event")) {
      throw new ForbiddenError({
        message: "Você precisa estar logado para gerenciar sua presença.",
      });
    }

    const { id } = await params;
    const counts = await event.removeRsvp(id, user.id);

    return Response.json({ rsvp: null, counts }, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
