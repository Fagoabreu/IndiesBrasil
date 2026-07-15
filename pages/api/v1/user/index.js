import { createRouter } from "next-connect";
import controller from "infra/controller";
import user from "models/user";
import session from "models/session";
import authorization from "@/models/authorization";
import uploadedImages from "@/models/uploadedImages";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:session"), getHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const sessionToken = request.cookies.session_id;

  const sessionObject = await session.findOneValidByToken(sessionToken);
  const renewedSessionObject = await session.renew(sessionObject.id);
  controller.setSessionCookie(renewedSessionObject.token, response);

  const userFound = await user.findOneById(sessionObject.user_id);
  if (userFound?.avatar_image) {
    const avatarImage = await uploadedImages.findById(userFound.avatar_image);
    userFound.avatar_image = avatarImage?.secure_url;
  }

  if (userFound?.background_image) {
    const backgroundImage = await uploadedImages.findById(userFound.background_image);
    userFound.background_image = backgroundImage?.secure_url;
  }
  response.setHeader("Cache-Control", "no-store,no-cache-max-age=0,must-revalidate");

  const secureOutputValues = authorization.filterOutput(userTryingToGet, "read:user:self", userFound);

  return response.status(200).json(secureOutputValues);
}
