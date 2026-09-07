import { createRouter } from "next-connect";
import controller from "infra/controller";
import testimonial from "models/testimonial";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:testimonial"), getHandler)
  .post(controller.canRequest("create:testimonial"), postHandler)
  .handler(controller.errorHandlers);

/**
 * GET /api/v1/testimonials
 *
 * Lista os depoimentos aprovados para exibição pública.
 */
async function getHandler(request, response) {
  const testimonials = await testimonial.listApproved();
  return response.status(200).json(testimonials);
}

/**
 * POST /api/v1/testimonials
 *
 * Body: { content, role? } — cria um depoimento do usuário logado.
 */
async function postHandler(request, response) {
  const requestUser = request.context.user;

  if (!requestUser?.id) {
    return response.status(401).json({
      status_code: 401,
      message: "Você precisa estar logado para enviar um depoimento.",
    });
  }

  const { content, role } = request.body || {};

  if (!content || typeof content !== "string" || !content.trim()) {
    return response.status(400).json({
      status_code: 400,
      message: 'Campo "content" é obrigatório.',
    });
  }

  if (content.trim().length > 500) {
    return response.status(400).json({
      status_code: 400,
      message: "O depoimento deve ter no máximo 500 caracteres.",
    });
  }

  if (role !== undefined && role !== null && typeof role !== "string") {
    return response.status(400).json({
      status_code: 400,
      message: 'Campo "role" deve ser um texto.',
    });
  }

  const created = await testimonial.create(
    {
      content: content.trim(),
      role: role || null,
    },
    requestUser.id,
  );

  return response.status(201).json(created);
}
