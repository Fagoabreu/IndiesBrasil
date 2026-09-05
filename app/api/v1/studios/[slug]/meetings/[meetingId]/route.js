import meeting from "@/models/meeting";
import organization from "@/models/organization";
import controller from "@/infra/controller";
import authorization from "@/models/authorization";
import { ensureStudioMemberOrOwner } from "@/lib/studioAccess";
import { ForbiddenError } from "@/infra/errors";

/**
 * GET /api/v1/studios/[slug]/meetings/[meetingId]
 * Detalhes de uma reunião do estúdio (membros, admins e dono).
 */
export async function GET(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "read:meeting")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para visualizar reuniões.",
      });
    }

    const { slug, meetingId } = await params;
    const studio = await organization.findBySlug(slug);
    await ensureStudioMemberOrOwner(user, studio);

    const found = await meeting.findByIdAndOrg(meetingId, studio.id);

    return Response.json(meeting.serializeMeeting(found), { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

/**
 * PATCH /api/v1/studios/[slug]/meetings/[meetingId]
 * Edita os dados da reunião (criador, admin ou dono do estúdio).
 * Body: { title?, description?, starts_at?, ends_at?, max_participants? }
 */
export async function PATCH(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "update:meeting")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para editar reuniões.",
      });
    }

    const { slug, meetingId } = await params;
    const studio = await organization.findBySlug(slug);
    await ensureStudioMemberOrOwner(user, studio);
    await meeting.findByIdAndOrg(meetingId, studio.id);

    const data = await request.json();
    const updated = await meeting.update(meetingId, data, user.id);

    return Response.json(meeting.serializeMeeting(updated), { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

/**
 * DELETE /api/v1/studios/[slug]/meetings/[meetingId]
 * Cancela a reunião (soft delete — histórico preservado).
 * Exige gestão da reunião (criador, admin ou dono do estúdio).
 * Nota: `delete:meeting` fica reservado para um futuro hard delete.
 */
export async function DELETE(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "update:meeting")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para cancelar reuniões.",
      });
    }

    const { slug, meetingId } = await params;
    const studio = await organization.findBySlug(slug);
    await ensureStudioMemberOrOwner(user, studio);
    await meeting.findByIdAndOrg(meetingId, studio.id);

    await meeting.cancel(meetingId, user.id);

    return new Response(null, { status: 204 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
