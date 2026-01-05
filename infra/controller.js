import * as cookie from "cookie";
import session from "models/session.js";
import user from "models/user.js";
import authorization from "models/authorization.js";

const { InternalServerError, MethodNotAllowedError, ValidationError, NotFoundError, UnauthorizedError, ForbiddenError } = require("./errors");

function onNoMatchHandler(request, response) {
  const publicErrorObject = new MethodNotAllowedError();
  response.status(publicErrorObject.statusCode).json(publicErrorObject);
}

function onErrorHandler(error, request, response) {
  if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ForbiddenError) {
    return response.status(error.statusCode).json(error);
  }

  if (error instanceof UnauthorizedError) {
    clearSessionCookie(response);
    return response.status(error.statusCode).json(error);
  }

  const publicErrorObject = new InternalServerError({
    cause: error,
  });
  console.error(publicErrorObject);
  response.status(publicErrorObject.statusCode).json(publicErrorObject);
}

async function setSessionCookie(sessionToken, response) {
  const isProduction = process.env.NODE_ENV === "production";
  const setCookie = cookie.serialize("session_id", sessionToken, {
    path: "/",
    maxAge: session.EXPIRATION_IN_MILLISECONDS / 1000,
    secure: isProduction,
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
  });

  response.setHeader("Set-Cookie", setCookie);
}

async function clearSessionCookie(response) {
  const setCookie = cookie.serialize("session_id", "invalid", {
    path: "/",
    maxAge: -1,
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  });
  response.setHeader("Set-Cookie", setCookie);
}
async function injectAnonymousOrUser(request, response, next) {
  if (request.cookies?.session_id) {
    await injectAuthenticatedUser(request, request.cookies.session_id);
    return next();
  }

  injectAnonymousUser(request);
  return next();
}

function injectAnonymousUser(request) {
  const anonymousUserObject = {
    features: ["read:activation_token", "create:session", "create:user", "read:user", "read:post"],
  };
  request.context = {
    ...request.context,
    user: anonymousUserObject,
  };
}

async function injectAuthenticatedUser(request, sessionToken) {
  const sessionObject = await session.findOneValidByToken(sessionToken);
  const userObject = await user.findOneById(sessionObject.user_id);
  request.context = {
    ...request.context,
    user: userObject,
  };
}

function canRequest(feature) {
  return function canRequestMiddleware(request, response, next) {
    const userTryingToRequest = request.context.user;
    if (authorization.can(userTryingToRequest, feature)) {
      return next();
    }
    console.log("User features:", userTryingToRequest.features, "\n Resquest", feature);
    throw new ForbiddenError({
      message: "Você não possui permissão para executar esta ação",
      action: `Verifique se o seu usuário possui a feature "${feature}" para executar esta ação.`,
    });
  };
}

export async function injectApiUser(request) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    injectAnonymousUser(request);
    return;
  }

  const cookies = cookie.parse(cookieHeader);
  const sessionToken = cookies.session_id;

  if (!sessionToken) {
    injectAnonymousUser(request);
    return;
  }

  await injectAuthenticatedUser(request, sessionToken);
}

const controller = {
  errorHandlers: {
    onNoMatch: onNoMatchHandler,
    onError: onErrorHandler,
  },
  setSessionCookie,
  clearSessionCookie,
  injectAnonymousOrUser,
  canRequest,
  injectAuthenticatedUser,
  injectApiUser,
  onErrorHandler,
};

export default controller;
