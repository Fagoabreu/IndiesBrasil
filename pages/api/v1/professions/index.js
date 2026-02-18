import controller from "@/infra/controller.js";
import authorization from "@/models/authorization";
import profession from "@/models/profession";
import { createRouter } from "next-connect";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.get(controller.canRequest("read:session"), getHandler);
router.post(controller.canRequest("read:admin"), postHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const selectedContactTypes = await profession.findAllRoles();
  const secureOutputValues = authorization.filterOutput(userTryingToGet, "read:profession:all", selectedContactTypes);
  return response.status(200).json(secureOutputValues);
}

async function postHandler(request, response) {
  const userTryingToPost = request.context.user;
  const inputValues = request.body;
  const insertedContactType = await profession.createRoles(inputValues);
  const secureOutputValues = authorization.filterOutput(userTryingToPost, "read:profession", insertedContactType);
  return response.status(200).json(secureOutputValues);
}
