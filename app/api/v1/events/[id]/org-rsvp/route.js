import event from "@/models/event";
import controller from "@/infra/controller";
import { ForbiddenError, ValidationError } from "@/infra/errors";
import authorization from "@/models/authorization";

/**
 * POST /api/v1/events/[id]/org-rsvp
 * Body: { org_id: string }
 * Confirma presença do estúdio no evento.
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
    const { org_id } = await request.json();

    if (!org_id) {
      throw new ValidationError({ message: "org_id é obrigatório." });
    }

    const counts = await event.upsertOrgRsvp(id, org_id, user.id);

    return Response.json({ counts }, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

/**
 * DELETE /api/v1/events/[id]/org-rsvp
 * Body: { org_id: string }
 * Remove a confirmação de presença do estúdio no evento.
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
    const { org_id } = await request.json();

    if (!org_id) {
      throw new ValidationError({ message: "org_id é obrigatório." });
    }

    const counts = await event.removeOrgRsvp(id, org_id, user.id);

    return Response.json({ counts }, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
