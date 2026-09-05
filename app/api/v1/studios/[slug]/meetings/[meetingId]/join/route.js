import meeting from "@/models/meeting";
import organization from "@/models/organization";
import controller from "@/infra/controller";
import authorization from "@/models/authorization";
import galene from "@/lib/galene";
import { ensureStudioMemberOrOwner } from "@/lib/studioAccess";
import { ForbiddenError } from "@/infra/errors";

/**
 * POST /api/v1/studios/[slug]/meetings/[meetingId]/join
 * Gera o link de entrada de um MEMBRO na sala Galene da reunião.
 * Provisiona o grupo (authKeys) quando necessário e emite um JWT curto
 * com as permissões de membro. A reunião precisa estar na janela de tempo.
 */
export async function POST(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "read:meeting")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para acessar reuniões.",
      });
    }

    const { slug, meetingId } = await params;
    const studio = await organization.findBySlug(slug);
    await ensureStudioMemberOrOwner(user, studio);

    const found = await meeting.findByIdAndOrg(meetingId, studio.id);
    meeting.assertCanJoin(found);

    await galene.ensureRoomProvisioned(found.room_id);
    const access = await galene.createJoinTokenAndUrl({
      roomId: found.room_id,
      username: user.username,
      permissions: galene.GALENE_PERMISSIONS.member,
      endsAt: found.ends_at,
    });

    return Response.json({ joinUrl: access.joinUrl, expires_at: access.expiresAt }, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
