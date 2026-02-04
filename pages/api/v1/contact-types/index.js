import controller from "@/infra/controller.js";
import contact from "@/models/contact";
import { createRouter } from "next-connect";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.get(controller.canRequest("read:session"), getHandler);
router.post(controller.canRequest("read:admin"), postHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const selectedContactTypes = await contact.findAllType();
  return response.status(200).json(selectedContactTypes);
}

async function postHandler(request, response) {
  const inputValues = request.body;
  const insertedContactType = await contact.createType(inputValues);
  return response.status(200).json(insertedContactType);
}
