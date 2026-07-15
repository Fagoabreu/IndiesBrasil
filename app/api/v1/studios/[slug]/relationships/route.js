import organization from "@/models/organization";
import controller from "@/infra/controller";
import { ForbiddenError, ValidationError } from "@/infra/errors";
import authorization from "@/models/authorization";

/**
 * GET /api/v1/studios/[slug]/relationships
 * Retorna { accepted, pending_incoming, pending_outgoing }
 */
export async function GET(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const { slug } = await params;

    const studio = await organization.findBySlug(slug);
    const data = await organization.getRelationships(studio.id);

    return Response.json(data, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

/**
 * POST /api/v1/studios/[slug]/relationships
 * Body: { target_slug: string, type: string }
 * Solicita um relacionamento com outro estúdio.
 * Requer que o usuário seja admin ou dono do estúdio [slug].
 */
export async function POST(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "create:studio")) {
      throw new ForbiddenError({ message: "Você precisa estar logado." });
    }

    const { slug } = await params;
    const { target_slug, type } = await request.json();

    if (!target_slug?.trim()) {
      throw new ValidationError({ message: "target_slug é obrigatório." });
    }
    if (!type) {
      throw new ValidationError({ message: "type é obrigatório." });
    }

    const studio = await organization.findBySlug(slug);

    const isAdminOrOwner = (await organization.isAdmin(studio.id, user.id)) || (await organization.isOwner(studio.id, user.id));
    if (!isAdminOrOwner) {
      throw new ForbiddenError({
        message: "Apenas administradores do estúdio podem solicitar relacionamentos.",
      });
    }

    const rel = await organization.requestRelationship(studio.id, target_slug.trim(), type, user.id);

    return Response.json(rel, { status: 201 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
