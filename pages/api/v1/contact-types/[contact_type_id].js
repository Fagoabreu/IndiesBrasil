import controller from "@/infra/controller.js";
import contact from "@/models/contact";
import { createRouter } from "next-connect";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.delete(controller.canRequest("read:admin"), deleteHandler);

export default router.handler(controller.errorHandlers);

async function deleteHandler(request, response) {
  const contact_type_id = request.query.contact_type_id;
  const postToDelete = await contact.deleteType(contact_type_id);
  return response.status(200).json(postToDelete);
}
