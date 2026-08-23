import { createRouter } from "next-connect";
import controller from "infra/controller";
import authorization from "models/authorization";
import store from "models/store";
import organization from "models/organization";
import { ForbiddenError, ValidationError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:store"), listHandler)
  .post(controller.canRequest("create:store:product"), createHandler)
  .handler(controller.errorHandlers);

async function listHandler(request, response) {
  const { page = 1, limit = 20, search = "", org = "" } = request.query;
  const requestUser = request.context.user;

  // Dono/admin do estúdio gerenciando a própria vitrine: vê também inativos.
  if (org && requestUser?.id) {
    const studio = await organization.findBySlug(org);
    const isOwner = await organization.isOwner(studio, requestUser.id);
    const isAdmin = await organization.isAdmin(studio.id, requestUser.id);
    if (isOwner || isAdmin) {
      const products = await store.findProductsByOrg(studio.id);
      return response.status(200).json(products);
    }
  }

  const products = await store.findAllProducts({
    page: Number(page),
    limit: Number(limit),
    search,
    orgSlug: org,
  });

  return response.status(200).json(products);
}

async function createHandler(request, response) {
  const requestUser = request.context.user;

  if (!authorization.can(requestUser, "create:store:product")) {
    throw new ForbiddenError({
      message: "Você não possui permissão para criar produtos.",
    });
  }

  const { organizationId, ...productData } = request.body;
  if (!organizationId) {
    throw new ValidationError({
      message: "O estúdio (organizationId) é obrigatório.",
    });
  }

  const newProduct = await store.createProduct(organizationId, requestUser.id, productData);
  return response.status(201).json(newProduct);
}
