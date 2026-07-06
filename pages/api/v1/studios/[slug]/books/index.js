import { createRouter } from "next-connect";
import controller from "infra/controller";
import book from "models/book";
import organization from "models/organization";
import { ForbiddenError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:book:all"), getHandler)
  .post(controller.canRequest("create:book"), postHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { slug } = request.query;
  const studio = await organization.findBySlug(slug);
  const books = await book.findByOrg(studio.id);
  return response.status(200).json(books);
}

async function postHandler(request, response) {
  const requestUser = request.context.user;
  const { slug } = request.query;

  const studio = await organization.findBySlug(slug);

  const isAdmin = await organization.isAdmin(studio.id, requestUser.id);
  const isOwner = studio.owner_id === requestUser.id;

  if (!isAdmin && !isOwner) {
    throw new ForbiddenError({
      message:
        "Apenas administradores do estúdio podem criar livros/quadrinhos.",
    });
  }

  const newBook = await book.create(requestUser.id, studio.id, request.body);
  return response.status(201).json(newBook);
}
