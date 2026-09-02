import controller from "@/infra/controller";
import moderation from "@/models/moderation";
import meeting from "@/models/meeting";
import organization from "@/models/organization";

/**
 * GET /api/v1/meetings/[code]
 * Detalhes públicos de uma reunião para o lobby de entrada
 * (página /reuniao/[code]). O código funciona como "chave" do link.
 */
export async function GET(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    const { code } = await params;
    const meetingRow = await meeting.findByCode(code);
    const org = await organization.findById(meetingRow.org_id);
    const isBlocked = await moderation.isBlocked("meeting", meetingRow.id);

    const viewer = await buildViewer(user, meetingRow, org, isBlocked);

    return Response.json(
      {
        id: meetingRow.id,
        code: meetingRow.code,
        title: meetingRow.title,
        description: meetingRow.description,
        status: meetingRow.status,
        starts_at: meetingRow.starts_at,
        ends_at: meetingRow.ends_at,
        ended_at: meetingRow.ended_at,
        is_blocked: isBlocked,
        created_by_username: meetingRow.created_by_username,
        org: {
          id: org.id,
          slug: org.slug,
          name: org.name,
          logo_url: meetingRow.org_logo_url || null,
        },
        viewer,
      },
      { status: 200 },
    );
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

async function buildViewer(user, meetingRow, org, isBlocked) {
  if (!user?.id) {
    return { is_authenticated: false, is_member: false, is_host: false };
  }

  const isHost = meetingRow.created_by === user.id;
  const [isMember, isAdmin] = await Promise.all([organization.isMember(org.id, user.id), organization.isAdmin(org.id, user.id)]);
  const isOwner = organization.isOwner(org, user.id);

  return {
    is_authenticated: true,
    is_member: isMember || isOwner || isAdmin,
    is_host: isHost,
    is_admin: isAdmin,
    is_owner: isOwner,
    is_blocked_for_user: isBlocked,
  };
}
