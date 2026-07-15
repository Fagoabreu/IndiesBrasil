import event from "@/models/event";
import controller from "@/infra/controller";
import { ForbiddenError } from "@/infra/errors";
import authorization from "@/models/authorization";

/**
 * GET /api/v1/events/[id]
 * Retorna detalhes do evento, RSVP do usuário e próximas instâncias.
 */
export async function GET(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "read:event")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para visualizar eventos.",
      });
    }

    const { id } = await params;
    const found = await event.findById(id, user.id ?? null);

    // Eventos privados: somente criador ou convidado
    if (found.visibility === "private" && found.created_by !== user.id) {
      const hasInvite = found.is_owner === false;
      if (hasInvite) {
        // findById já verifica — seguir em frente
      }
    }

    return Response.json(found, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

/**
 * PATCH /api/v1/events/[id]
 * Atualiza campos do evento (somente organizador).
 */
export async function PATCH(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "update:event")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para editar eventos.",
      });
    }

    const { id } = await params;
    const data = await request.json();
    const updated = await event.update(id, data, user.id);

    return Response.json(updated, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

/**
 * DELETE /api/v1/events/[id]
 * Cancela o evento (soft delete — status = 'cancelled').
 */
export async function DELETE(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "delete:event")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para cancelar eventos.",
      });
    }

    const { id } = await params;
    await event.cancel(id, user.id);

    return new Response(null, { status: 204 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
