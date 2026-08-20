import controller from "@/infra/controller";
import authorization from "@/models/authorization";
import report from "@/models/report";
import { ForbiddenError, ValidationError } from "@/infra/errors";

/**
 * POST /api/v1/reports
 * Cria uma denúncia. Requer usuário autenticado (feature `create:report`).
 * Body (JSON): { target_type, target_id, reason, justification? }
 */
export async function POST(request) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "create:report")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para realizar denúncias.",
        action: "Entre na sua conta para denunciar conteúdo.",
      });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      throw new ValidationError({
        message: "Corpo da requisição inválido.",
        action: "Envie os dados da denúncia em JSON.",
      });
    }

    const { target_type, target_id, reason, justification } = body;

    const createdReport = await report.create({
      reporterId: user.id,
      targetType: target_type,
      targetId: target_id,
      reason,
      justification,
    });

    return Response.json(createdReport, { status: 201 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

/**
 * GET /api/v1/reports?status=&target_type=&limit=
 * Lista denúncias. Exclusivo de administradores (`read:admin`).
 */
export async function GET(request) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "read:admin")) {
      throw new ForbiddenError({
        message: "Acesso restrito a administradores.",
        action: "Você não possui permissão para visualizar denúncias.",
      });
    }

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status");
    const targetType = searchParams.get("target_type");
    const limit = Number.parseInt(searchParams.get("limit") || "50", 10);

    const reports = await report.findAll({ status, targetType, limit });

    return Response.json(reports, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
