import event from "@/models/event";
import organization from "@/models/organization";
import controller from "@/infra/controller";
import authorization from "@/models/authorization";
import { ensureStudioMemberOrOwner } from "@/lib/studioAccess";
import { ForbiddenError, NotFoundError } from "@/infra/errors";

/**
 * Resolve o evento **do estúdio** do endereço.
 *
 * Evento de outro estúdio responde 404, não 403: confirmar que existe um evento
 * ali revelaria o conteúdo de outro estúdio a quem tem acesso a este. É o mesmo
 * critério da conversa de outra pessoa (`models/conversation.js`).
 */
async function resolveStudioEvent(request, params) {
  const { slug, eventId } = await params;
  const studio = await organization.findBySlug(slug);
  await ensureStudioMemberOrOwner(request.context.user, studio);

  const found = await event.findById(eventId, request.context.user.id);
  if (found.organization_id !== studio.id) {
    throw new NotFoundError({ message: "Evento não encontrado." });
  }

  return found;
}

/**
 * PATCH /api/v1/studios/[slug]/events/[eventId]
 *
 * Mesmo corpo de `PATCH /api/v1/events/[id]`. A diferença é a porta de entrada:
 * aqui o evento é conferido contra o estúdio do endereço antes de qualquer
 * escrita, e a permissão aceita qualquer membro ativo (ver `canManageEvent`).
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

    const found = await resolveStudioEvent(request, params);
    const data = await request.json();
    const updated = await event.update(found.id, data, user.id);

    return Response.json(updated, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

/** DELETE — cancela (soft delete, `status = 'cancelled'`). */
export async function DELETE(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "delete:event")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para cancelar eventos.",
      });
    }

    const found = await resolveStudioEvent(request, params);
    await event.cancel(found.id, user.id);

    return new Response(null, { status: 204 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
