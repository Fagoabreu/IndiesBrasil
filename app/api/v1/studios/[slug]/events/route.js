import event from "@/models/event";
import organization from "@/models/organization";
import controller from "@/infra/controller";
import authorization from "@/models/authorization";
import { ensureStudioMemberOrOwner } from "@/lib/studioAccess";
import { ForbiddenError } from "@/infra/errors";

/**
 * GET /api/v1/studios/[slug]/events
 *
 * Agenda do estúdio — membros, admins e dono. Query: `?includePast=true`.
 *
 * Lista **instâncias** (uma linha por ocorrência), como a agenda pública: o
 * card mostra a data de cada uma, e um evento recorrente seria um único item com
 * a data errada.
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

    const { slug } = await params;
    const studio = await organization.findBySlug(slug);
    await ensureStudioMemberOrOwner(user, studio);

    const includePast = request.nextUrl.searchParams.get("includePast") === "true";
    const events = await event.findByOrg(studio.id, { includePast });

    return Response.json(events, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

/**
 * POST /api/v1/studios/[slug]/events
 *
 * `organization_id` vem do **endereço**, não do corpo: deixar o cliente
 * escolher permitiria criar um evento "do estúdio" num estúdio de que ele não
 * participa. O model revalida de qualquer forma (`resolveOrganization`), porque
 * `POST /api/v1/events` também grava estúdio quando o corpo traz o campo.
 */
export async function POST(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "create:event")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para criar eventos.",
      });
    }

    const { slug } = await params;
    const studio = await organization.findBySlug(slug);
    await ensureStudioMemberOrOwner(user, studio);

    const data = await request.json();
    const created = await event.create({ ...data, organization_id: studio.id }, user.id);

    return Response.json(created, { status: 201 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
