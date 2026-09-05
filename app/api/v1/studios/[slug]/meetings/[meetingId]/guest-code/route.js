import meeting from "@/models/meeting";
import organization from "@/models/organization";
import controller from "@/infra/controller";
import authorization from "@/models/authorization";
import { ensureStudioMemberOrOwner } from "@/lib/studioAccess";
import { ForbiddenError } from "@/infra/errors";

/**
 * POST /api/v1/studios/[slug]/meetings/[meetingId]/guest-code
 * Gera (ou regera) o código temporário de convidado da reunião.
 * Body: { expires_at?: string } — padrão: término da reunião.
 * O código em texto puro é retornado UMA única vez (só o hash é gravado).
 */
export async function POST(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "update:meeting")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para gerenciar o código de convidado.",
      });
    }

    const { slug, meetingId } = await params;
    const studio = await organization.findBySlug(slug);
    await ensureStudioMemberOrOwner(user, studio);
    await meeting.findByIdAndOrg(meetingId, studio.id);

    let data = {};
    try {
      data = await request.json();
    } catch {
      data = {};
    }

    const guestCodeInfo = await meeting.createGuestCode(meetingId, user.id, data);

    return Response.json(guestCodeInfo, { status: 201 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

/**
 * DELETE /api/v1/studios/[slug]/meetings/[meetingId]/guest-code
 * Revoga o código ativo (invalida convites externos pendentes).
 */
export async function DELETE(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "update:meeting")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para gerenciar o código de convidado.",
      });
    }

    const { slug, meetingId } = await params;
    const studio = await organization.findBySlug(slug);
    await ensureStudioMemberOrOwner(user, studio);
    await meeting.findByIdAndOrg(meetingId, studio.id);

    await meeting.revokeGuestCode(meetingId, user.id);

    return new Response(null, { status: 204 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
