import controller from "@/infra/controller";
import authorization from "@/models/authorization";
import organization from "@/models/organization";
import meeting from "@/models/meeting";
import { ForbiddenError, NotFoundError, ValidationError } from "@/infra/errors";

const MAX_TTL_HOURS = 24 * 7; // 7 dias
const DEFAULT_TTL_HOURS = 24;

async function requireManager(studio, user, found) {
  const isAdmin = await organization.isAdmin(studio.id, user.id);
  const isOwner = organization.isOwner(studio, user.id);
  const isHost = found.created_by === user.id;
  if (!isHost && !isAdmin && !isOwner) {
    throw new ForbiddenError({
      message: "Apenas o organizador ou administradores do estúdio podem gerenciar convites.",
    });
  }
  return { isHost, isAdmin, isOwner };
}

/**
 * GET /api/v1/studios/[slug]/meetings/[code]/guest-keys
 * Lista chaves de convite da reunião (gerência).
 */
export async function GET(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "update:meeting")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para gerenciar convites de reunião.",
      });
    }

    const { slug, code } = await params;
    const studio = await organization.findBySlug(slug);
    const found = await meeting.findByCode(code);
    if (found.org_id !== studio.id) throw new NotFoundError({ message: "Reunião não encontrada." });

    await requireManager(studio, user, found);
    const keys = await meeting.listGuestKeys(found.id);
    return Response.json(keys, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

/**
 * POST /api/v1/studios/[slug]/meetings/[code]/guest-keys
 * Cria um link de convite temporário. Body: { ttl_hours? }.
 * Retorna o token cru UMA única vez no link de acesso.
 */
export async function POST(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "update:meeting")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para criar convites de reunião.",
      });
    }

    const { slug, code } = await params;
    const studio = await organization.findBySlug(slug);
    const found = await meeting.findByCode(code);
    if (found.org_id !== studio.id) throw new NotFoundError({ message: "Reunião não encontrada." });

    await requireManager(studio, user, found);

    const body = await request.json().catch(() => null);
    let ttlHours = body?.ttl_hours ?? DEFAULT_TTL_HOURS;
    if (!Number.isInteger(ttlHours) || ttlHours < 1 || ttlHours > MAX_TTL_HOURS) {
      throw new ValidationError({
        message: "Validade do convite inválida.",
        action: "Informe um valor entre 1 e 168 horas.",
      });
    }

    const { rawToken, guestKey } = await meeting.createGuestKey({
      meeting_id: found.id,
      created_by: user.id,
      ttl_ms: ttlHours * 60 * 60 * 1000,
    });

    const origin = new URL(request.url).origin;
    const joinUrl = `${origin}/reuniao/${found.code}?convite=${encodeURIComponent(rawToken)}`;

    return Response.json(
      {
        guest_key: guestKey,
        token: rawToken,
        join_url: joinUrl,
        expires_at: guestKey.expires_at,
      },
      { status: 201 },
    );
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
