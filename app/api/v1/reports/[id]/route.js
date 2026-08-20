import controller from "@/infra/controller";
import authorization from "@/models/authorization";
import report from "@/models/report";
import { ForbiddenError, ValidationError } from "@/infra/errors";

/**
 * PATCH /api/v1/reports/[id]
 * Analisa (resolve/dismiss) uma denúncia. Exclusivo de administradores.
 * Body (JSON): { status: "resolved" | "dismissed", resolution_note? }
 */
export async function PATCH(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "read:admin")) {
      throw new ForbiddenError({
        message: "Acesso restrito a administradores.",
        action: "Você não possui permissão para analisar denúncias.",
      });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      throw new ValidationError({
        message: "Corpo da requisição inválido.",
        action: "Envie os dados de análise em JSON.",
      });
    }

    const { id } = await params;
    const { status, resolution_note } = body;

    const resolvedReport = await report.resolve({
      id,
      moderatorId: user.id,
      status,
      resolutionNote: resolution_note,
    });

    return Response.json(resolvedReport, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
