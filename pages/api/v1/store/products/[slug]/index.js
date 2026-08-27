import { createRouter } from "next-connect";
import controller from "infra/controller";
import authorization from "models/authorization";
import store from "models/store";
import organization from "models/organization";
import { ForbiddenError } from "infra/errors";

// Imagens de produto são enviadas como data URL base64 no corpo do JSON;
// o limite padrão do bodyParser (1mb) não comporta PNGs recortados.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
};

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:store"), getHandler)
  .patch(controller.canRequest("update:store:product"), patchHandler)
  .delete(controller.canRequest("delete:store:product"), deleteHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;

  const product = await store.findProductBySlug(slug);

  const gallery = await store.findProductImages(product.id);
  let images = gallery;
  if (images.length === 0 && product.image_url) {
    images = [{ image_id: product.image_id, secure_url: product.image_url }];
  }

  let viewer = null;
  if (requestUser?.id) {
    const org = await organization.findById(product.organization_id);
    const isOwner = await organization.isOwner(org, requestUser.id);
    const isAdmin = await organization.isAdmin(org.id, requestUser.id);
    viewer = { canManage: isOwner || isAdmin };
  }

  return response.status(200).json({ ...product, viewer, images });
}

async function patchHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;

  if (!authorization.can(requestUser, "update:store:product")) {
    throw new ForbiddenError({
      message: "Você não possui permissão para editar produtos.",
    });
  }

  const updated = await store.updateProduct(slug, requestUser.id, request.body);
  return response.status(200).json(updated);
}

async function deleteHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;

  if (!authorization.can(requestUser, "delete:store:product")) {
    throw new ForbiddenError({
      message: "Você não possui permissão para remover produtos.",
    });
  }

  await store.deleteProduct(slug, requestUser.id);
  return response.status(204).end();
}
