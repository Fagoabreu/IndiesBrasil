import controller from "@/infra/controller";
import authorization from "@/models/authorization";
import organization from "@/models/organization";
import meeting from "@/models/meeting";
import livekit from "@/lib/livekit";
import { ForbiddenError, ValidationError, NotFoundError } from "@/infra/errors";

/** Fecha a sala no SFU (se existir) sem bloquear a resposta. */
async function closeLiveRoomIfAny(code) {
  try {
    await livekit.closeMeetingRoom(code);
  } catch (error) {
    // Sala inexistente (nunca iniciada) é esperado — não é falha.
    console.error(`[meetings] erro ao fechar sala LiveKit ${code}:`, error?.message);
  }
}

async function requireStudioAccess(studio, user) {
  const isAdmin = await organization.isAdmin(studio.id, user.id);
  const isOwner = organization.isOwner(studio, user.id);
  if (isAdmin || isOwner) return { isAdmin, isOwner, isMember: true };
  const isMember = await organization.isMember(studio.id, user.id);
  if (!isMember) {
    throw new ForbiddenError({
      message: "Apenas membros do estúdio podem acessar as reuniões.",
      action: "Entre como membro do estúdio para continuar.",
    });
  }
  return { isAdmin, isOwner, isMember };
}

async function fetchMeetingInStudio(studio, code) {
  const found = await meeting.findByCode(code);
  if (found.org_id !== studio.id) {
    throw new NotFoundError({ message: "Reunião não encontrada." });
  }
  return found;
}

/**
 * GET /api/v1/studios/[slug]/meetings/[code]
 * Detalhe + viewer + chaves de convite (apenas para quem gerencia).
 */
export async function GET(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "read:meeting")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para visualizar reuniões.",
        action: "Entre na sua conta para continuar.",
      });
    }

    const { slug, code } = await params;
    const studio = await organization.findBySlug(slug);
    const access = await requireStudioAccess(studio, user);
    const found = await fetchMeetingInStudio(studio, code);

    const isHost = found.created_by === user.id;
    const canManage = isHost || access.isAdmin || access.isOwner;

    const payload = { ...found, viewer: { ...access, isHost, canManage } };
    if (canManage) {
      payload.guest_keys = await meeting.listGuestKeys(found.id);
    }
    return Response.json(payload, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

/**
 * PATCH /api/v1/studios/[slug]/meetings/[code]
 * Edita metadados ou executa ações de ciclo de vida (host/admin/owner).
 * Ações: { action: 'start' | 'end' | 'cancel' } ou campos
 * { title?, description?, starts_at?, ends_at? }.
 */
export async function PATCH(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "update:meeting")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para gerenciar reuniões.",
        action: "Entre na sua conta para continuar.",
      });
    }

    const { slug, code } = await params;
    const studio = await organization.findBySlug(slug);
    const access = await requireStudioAccess(studio, user);
    const found = await fetchMeetingInStudio(studio, code);

    const isHost = found.created_by === user.id;
    if (!isHost && !access.isAdmin && !access.isOwner) {
      throw new ForbiddenError({
        message: "Apenas o organizador ou administradores do estúdio podem gerenciar a reunião.",
      });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      throw new ValidationError({ message: "Corpo da requisição inválido." });
    }

    const action = body.action;
    let updated;
    if (action === "start") {
      updated = await meeting.start(code);
    } else if (action === "end") {
      updated = await meeting.end(code);
      await closeLiveRoomIfAny(code);
    } else if (action === "cancel") {
      updated = await meeting.cancel(code);
      await closeLiveRoomIfAny(code);
    } else if (action === undefined) {
      updated = await meeting.updateDetails(code, {
        title: body.title,
        description: body.description,
      });
    } else {
      throw new ValidationError({ message: "Ação inválida." });
    }

    const result = await meeting.findByCode(updated.code);
    const updatedAccess = await requireStudioAccess(studio, user);
    const updatedIsHost = result.created_by === user.id;
    return Response.json(
      { ...result, viewer: { ...updatedAccess, isHost: updatedIsHost, canManage: updatedIsHost || updatedAccess.isAdmin || updatedAccess.isOwner } },
      { status: 200 },
    );
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

/**
 * DELETE /api/v1/studios/[slug]/meetings/[code]
 * Encerra (se ativa) ou cancela (se agendada). Host/admin/owner.
 */
export async function DELETE(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "delete:meeting")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para encerrar reuniões.",
        action: "Entre na sua conta para continuar.",
      });
    }

    const { slug, code } = await params;
    const studio = await organization.findBySlug(slug);
    const access = await requireStudioAccess(studio, user);
    const found = await fetchMeetingInStudio(studio, code);

    const isHost = found.created_by === user.id;
    if (!isHost && !access.isAdmin && !access.isOwner) {
      throw new ForbiddenError({
        message: "Apenas o organizador ou administradores do estúdio podem encerrar a reunião.",
      });
    }

    const updated = found.status === "scheduled" ? await meeting.cancel(code) : await meeting.end(code);
    await closeLiveRoomIfAny(code);
    const result = await meeting.findByCode(updated.code);
    return Response.json(result, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
