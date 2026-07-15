import controller from "@/infra/controller.js";
import authorization from "@/models/authorization";
import contact from "@/models/contact";
import { createRouter } from "next-connect";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .delete(controller.canRequest("read:admin"), deleteHandler)
  .handler(controller.errorHandlers);

async function deleteHandler(request, response) {
  const userTryingToRead = request.context.user;
  const contact_type_id = request.query.contact_type_id;
  const postToDelete = await contact.deleteType(contact_type_id);
  const secureOutputValues = authorization.filterOutput(userTryingToRead, "read:contact_type", postToDelete);
  return response.status(200).json(secureOutputValues);
}
