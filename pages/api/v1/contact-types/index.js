import controller from "@/infra/controller.js";
import authorization from "@/models/authorization";
import contact from "@/models/contact";
import { createRouter } from "next-connect";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.get(controller.canRequest("read:session"), getHandler);
router.post(controller.canRequest("read:admin"), postHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToRequest = request.context.user;
  const selectedContactTypes = await contact.findAllType();
  const secureOutputValues = authorization.filterOutput(userTryingToRequest, "read:contact_type:all", selectedContactTypes);
  return response.status(200).json(secureOutputValues);
}

async function postHandler(request, response) {
  const userTryingToPost = request.context.user;
  const inputValues = request.body;
  const insertedContactType = await contact.createType(inputValues);
  const secureOutputValues = authorization.filterOutput(userTryingToPost, "read:contact_type", insertedContactType);
  return response.status(200).json(secureOutputValues);
}
