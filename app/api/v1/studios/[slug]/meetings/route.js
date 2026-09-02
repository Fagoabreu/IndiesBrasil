import controller from "@/infra/controller";
import authorization from "@/models/authorization";
import organization from "@/models/organization";
import meeting from "@/models/meeting";
import notification from "@/models/notification";
import { ForbiddenError, ValidationError } from "@/infra/errors";

const MEETING_STATUSES = ["scheduled", "active", "ended", "cancelled"];

async function requireStudioMember(studio, user) {
  const isAdmin = await organization.isAdmin(studio.id, user.id);
  const isOwner = organization.isOwner(studio, user.id);
  if (isAdmin || isOwner) return { isAdmin, isOwner };
  const isMember = await organization.isMember(studio.id, user.id);
  if (!isMember) {
    throw new ForbiddenError({
      message: "Apenas membros do estúdio podem acessar as reuniões.",
      action: "Entre como membro do estúdio para continuar.",
    });
  }
  return { isAdmin, isOwner, isMember };
}

/**
 * GET /api/v1/studios/[slug]/meetings?status=
 * Lista reuniões do estúdio (apenas membros/admin/owner).
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

    const { slug } = await params;
    const studio = await organization.findBySlug(slug);
    await requireStudioMember(studio, user);

    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? undefined;
    if (status && !MEETING_STATUSES.includes(status)) {
      throw new ValidationError({ message: "Status de reunião inválido." });
    }

    const meetings = await meeting.listByOrg(studio.id, { status });
    return Response.json(meetings, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

/**
 * POST /api/v1/studios/[slug]/meetings
 * Cria uma reunião. Body: { title, description?, starts_at?, ends_at? }.
 * - Com starts_at → reunião agendada (notifica os membros).
 * - Sem starts_at → reunião imediata (sala já ativa).
 */
export async function POST(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "create:meeting")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para criar reuniões.",
        action: "Entre na sua conta para continuar.",
      });
    }

    const { slug } = await params;
    const studio = await organization.findBySlug(slug);
    await requireStudioMember(studio, user);

    const body = await request.json().catch(() => null);
    if (!body) {
      throw new ValidationError({ message: "Corpo da requisição inválido." });
    }

    const created = await meeting.create({
      org_id: studio.id,
      created_by: user.id,
      title: body.title,
      description: body.description,
      starts_at: body.starts_at || null,
      ends_at: body.ends_at || null,
    });

    // Reunião agendada → notifica os demais membros ativos (link facilitado).
    if (created.status === "scheduled") {
      notifyMembersScheduled(studio.id, studio.slug, user.id, created.code).catch((err) =>
        console.error("[meetings] erro ao notificar membros:", err?.message),
      );
    }

    const result = await meeting.findByCode(created.code);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

/** Notifica todos os membros ativos (exceto o criador) sobre a reunião agendada. */
async function notifyMembersScheduled(orgId, orgSlug, creatorId, meetingCode) {
  const members = await organization.findMembers(orgId);
  await Promise.all(
    members
      .filter((member) => member.id !== creatorId)
      .map((member) =>
        notification
          .createUserNotification({
            user_id: member.id,
            type: "meeting_scheduled",
            source_user_id: creatorId,
            org_slug: orgSlug,
            meeting_code: meetingCode,
          })
          .catch((err) => console.error("[meetings] erro ao notificar membro:", err?.message)),
      ),
  );
}
