import { createRouter } from "next-connect";
import controller from "infra/controller";
import rateLimit from "lib/rate-limit.js";
import testimonial from "models/testimonial";
import { MAX_TESTIMONIAL_CONTENT_LENGTH } from "lib/testimonial";
import { ValidationError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:testimonial"), getHandler)
  .post(controller.rateLimitBy({ limiter: rateLimit.limiters.write }), controller.canRequest("create:testimonial"), postHandler)
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
 * Body: { content, role? } — cria o depoimento do usuário logado.
 *
 * **Um por pessoa**: quem já tem depoimento recebe 400 com a instrução de
 * editar o existente (`PATCH /api/v1/testimonials/mine`). A regra vive no
 * model e no índice único — a rota não é o único caminho de escrita.
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
    throw new ValidationError({
      message: "O depoimento não pode estar vazio.",
      action: "Escreva o depoimento antes de enviar.",
    });
  }

  if (content.trim().length > MAX_TESTIMONIAL_CONTENT_LENGTH) {
    throw new ValidationError({
      message: `O depoimento deve ter no máximo ${MAX_TESTIMONIAL_CONTENT_LENGTH} caracteres.`,
    });
  }

  if (role !== undefined && role !== null && typeof role !== "string") {
    throw new ValidationError({ message: 'Campo "role" deve ser um texto.' });
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
