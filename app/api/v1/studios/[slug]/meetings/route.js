import meeting from "@/models/meeting";
import organization from "@/models/organization";
import controller from "@/infra/controller";
import authorization from "@/models/authorization";
import { ensureStudioMemberOrOwner } from "@/lib/studioAccess";
import { ForbiddenError } from "@/infra/errors";

/**
 * GET /api/v1/studios/[slug]/meetings
 * Lista a agenda de reuniões do estúdio (membros, admins e dono).
 * Query: ?status=scheduled|live|ended|cancelled&includePast=true
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

    const { slug } = await params;
    const studio = await organization.findBySlug(slug);
    await ensureStudioMemberOrOwner(user, studio);

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status") || undefined;
    const includePast = searchParams.get("includePast") === "true";

    const meetings = await meeting.listByOrgId(studio.id, { status, includePast });
    const publicMeetings = meetings.map((row) => meeting.serializeMeeting(row));

    return Response.json(publicMeetings, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

/**
 * POST /api/v1/studios/[slug]/meetings
 * Agenda uma reunião (Webconferência/Galene) para o estúdio.
 * Body: { title, description?, starts_at, ends_at, max_participants? }
 */
export async function POST(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "create:meeting")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para agendar reuniões.",
      });
    }

    const { slug } = await params;
    const studio = await organization.findBySlug(slug);
    await ensureStudioMemberOrOwner(user, studio);

    const data = await request.json();
    const created = await meeting.create({ ...data, org_id: studio.id }, user.id);

    return Response.json(meeting.serializeMeeting(created), { status: 201 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
