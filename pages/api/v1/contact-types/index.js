import controller from "@/infra/controller.js";
import authorization from "@/models/authorization";
import contact from "@/models/contact";
import { createRouter } from "next-connect";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:session"), getHandler)
  .post(controller.canRequest("read:admin"), postHandler)
  .handler(controller.errorHandlers);

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
