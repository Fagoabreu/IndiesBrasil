import { createRouter } from "next-connect";
import controller from "infra/controller";
import contentRating from "models/content-rating";

export default createRouter().use(controller.injectAnonymousOrUser).get(getHandler).post(postHandler).handler(controller.errorHandlers);

/**
 * GET /api/v1/content-rating?type=game|boardgame|book
 *
 * Retorna o questionário de classificação indicativa para o tipo solicitado.
 */
async function getHandler(request, response) {
  const { type } = request.query;

  if (!type || !["game", "boardgame", "book"].includes(type)) {
    return response.status(400).json({
      status_code: 400,
      message: 'Parâmetro "type" é obrigatório. Valores: game, boardgame, book.',
    });
  }

  const questionnaireMap = {
    game: contentRating.GAME_QUESTIONNAIRE,
    boardgame: contentRating.BOARDGAME_QUESTIONNAIRE,
    book: contentRating.BOOK_QUESTIONNAIRE,
  };

  return response.status(200).json(questionnaireMap[type]);
}

/**
 * POST /api/v1/content-rating
 *
 * Body com action:
 *   "calculate": { action, type, answers } → calcula, sem salvar.
 *   "save":      { action, type, slug, rating, reasons, monetizationFlags } → persiste.
 */
async function postHandler(request, response) {
  const requestUser = request.context.user;

  if (!requestUser?.id) {
    return response.status(401).json({
      status_code: 401,
      message: "Você precisa estar logado para classificar um conteúdo.",
    });
  }

  const { action, type, answers, slug, rating, reasons, monetizationFlags } = request.body;

  if (!type || !["game", "boardgame", "book"].includes(type)) {
    return response.status(400).json({
      status_code: 400,
      message: 'Campo "type" é obrigatório. Valores: game, boardgame, book.',
    });
  }

  if (action === "calculate") {
    if (!answers || typeof answers !== "object" || Object.keys(answers).length === 0) {
      return response.status(400).json({
        status_code: 400,
        message: 'Campo "answers" é obrigatório com as respostas do questionário.',
      });
    }

    let result;
    if (type === "game") {
      result = contentRating.calculateGameRating(answers);
    } else if (type === "boardgame") {
      result = contentRating.calculateBoardgameRating(answers);
    } else {
      result = contentRating.calculateBookRating(answers);
    }

    return response.status(200).json({
      rating: result.rating,
      reasons: result.reasons,
      label: contentRating.RATING_LABELS[result.rating],
      ...(result.monetizationFlags && {
        monetizationFlags: result.monetizationFlags,
      }),
    });
  }

  if (action === "save") {
    if (!slug) {
      return response.status(400).json({ status_code: 400, message: 'Campo "slug" é obrigatório.' });
    }

    if (!rating || !contentRating.RATING_LABELS[rating]) {
      return response.status(400).json({
        status_code: 400,
        message: `Campo "rating" é obrigatório. Valores: ${Object.keys(contentRating.RATING_LABELS).join(", ")}`,
      });
    }

    const result = await contentRating.saveRating(type, slug, rating, reasons || [], requestUser.id, monetizationFlags);

    return response.status(200).json({
      ...result,
      label: contentRating.RATING_LABELS[rating],
    });
  }

  return response.status(400).json({
    status_code: 400,
    message: 'Campo "action" deve ser "calculate" ou "save".',
  });
}
