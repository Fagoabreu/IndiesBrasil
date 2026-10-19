import * as cookie from "cookie";
import session from "models/session.js";
import user from "models/user.js";
import authorization from "models/authorization.js";
import moderation from "models/moderation.js";
import rateLimit from "lib/rate-limit.js";
import { NextResponse } from "next/server";

const {
  InternalServerError,
  MethodNotAllowedError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  TooManyRequestsError,
} = require("./errors");

function onNoMatchHandler(request, response) {
  const publicErrorObject = new MethodNotAllowedError();
  response.status(publicErrorObject.statusCode).json(publicErrorObject);
}

function onErrorHandler(error, request, response) {
  if (
    error instanceof ValidationError ||
    error instanceof NotFoundError ||
    error instanceof ForbiddenError ||
    error instanceof TooManyRequestsError
  ) {
    if (error instanceof TooManyRequestsError && error.retryAfterSeconds) {
      response.setHeader("Retry-After", String(error.retryAfterSeconds));
    }
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

function onRouterErrorHandler(error) {
  if (
    error instanceof ValidationError ||
    error instanceof NotFoundError ||
    error instanceof ForbiddenError ||
    error instanceof TooManyRequestsError
  ) {
    const response = NextResponse.json(error, { status: error.statusCode });
    if (error instanceof TooManyRequestsError && error.retryAfterSeconds) {
      response.headers.set("Retry-After", String(error.retryAfterSeconds));
    }
    return response;
  }
  if (error instanceof UnauthorizedError) {
    const response = NextResponse.json(error, { status: error.statusCode });
    clearSessionCookieAppRouter(response);
    return response;
  }
  const publicErrorObject = new InternalServerError({
    cause: error,
  });
  console.error(publicErrorObject);
  return NextResponse.json(publicErrorObject, {
    status: publicErrorObject.statusCode,
  });
}

function clearSessionCookieAppRouter(response) {
  const setCookie = cookie.serialize("session_id", "invalid", {
    path: "/",
    maxAge: -1,
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  });
  response.headers.set("Set-Cookie", setCookie);
}

function setSessionCookie(sessionToken, response) {
  const isProduction = process.env.NODE_ENV === "production";
  const setCookie = cookie.serialize("session_id", sessionToken, {
    path: "/",
    maxAge: session.EXPIRATION_IN_MILLISECONDS / 1000,
    secure: isProduction,
    httpOnly: true,
    sameSite: "lax",
  });

  response.setHeader("Set-Cookie", setCookie);
}

function clearSessionCookie(response) {
  const isProduction = process.env.NODE_ENV === "production";
  const setCookie = cookie.serialize("session_id", "invalid", {
    path: "/",
    maxAge: -1,
    secure: isProduction,
    httpOnly: true,
    sameSite: "lax",
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

/**
 * O que um visitante **sem sessão** pode ler — a fonte única.
 *
 * Esta lista é o contrato de leitura pública do site. Ela nasceu como detalhe
 * interno de `injectAnonymousUser` (middleware das rotas de API) e virou o
 * ponto de encontro de dois caminhos: as rotas a consultam pelo middleware, e
 * as páginas que montam o conteúdo no servidor a consultam por
 * {@link anonymousCan}, porque `getServerSideProps` não passa por middleware
 * nenhum.
 *
 * Sem isso os dois caminhos divergem: revogar um item daqui parava a API e a
 * página continuava servindo o mesmo conteúdo, sem nada indicando a diferença.
 * Com a lista compartilhada, tirar um item derruba a API **e** as páginas
 * correspondentes — que é o efeito desejado.
 */
const ANONYMOUS_FEATURES = Object.freeze([
  "read:activation_token",
  "create:session",
  "create:user",
  "read:user",
  "read:post",
  "read:event",
  "read:studio",
  "read:game",
  "read:game:all",
  "read:boardgame",
  "read:boardgame:all",
  "read:book",
  "read:book:all",
  "read:asset",
  "read:asset:all",
  "read:asset_category",
  "read:asset_category:all",
  "read:news",
  "read:news:all",
  "read:testimonial",
  "read:content_review",
  "read:content_review:all",
  "read:course",
  "read:course:lesson",
  "read:course:rating",
  "read:course:comment",
  "read:store",
]);

/** Usuário anônimo no formato que `authorization.can` exige (só `features`). */
export function getAnonymousUser() {
  return { features: ANONYMOUS_FEATURES };
}

/**
 * Verdadeiro quando o visitante sem sessão tem a feature.
 *
 * É o mesmo teste que `canRequest` aplica às rotas, exposto para quem renderiza
 * a página no servidor: ali não existe a tríade (request, response, next) e o
 * `getServerSideProps` não tem como rodar o middleware. Use `notFound` quando
 * a resposta for negativa — o projeto já prefere 404 a 403 para conteúdo que o
 * visitante não pode ver (ver `models/conversation.js`).
 */
export function anonymousCan(feature) {
  return authorization.can(getAnonymousUser(), feature);
}

function injectAnonymousUser(request) {
  request.context = {
    ...request.context,
    user: getAnonymousUser(),
  };
}

async function injectAuthenticatedUser(request, sessionToken) {
  const sessionObject = await session.findOneValidByToken(sessionToken);
  const userObject = await user.findOneById(sessionObject.user_id);

  // Usuários bloqueados são tratados como anônimos: perdem todas as
  // permissões e todo o conteúdo some dos feeds (suspensão centralizada).
  const isBlocked = await moderation.isBlocked("user", userObject.id);
  if (isBlocked) {
    injectAnonymousUser(request);
    return;
  }

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

    throw new ForbiddenError({
      message: "Você não possui permissão para executar esta ação",
      action: `Verifique se o seu usuário possui a feature "${feature}" para executar esta ação.`,
    });
  };
}

/**
 * Middleware de rate limit. Usa o limiter informado, chaveado pelo IP do
 * cliente (ou por uma função `keyBy` quando o IP sozinho é grosseiro demais,
 * ex.: criação de conta — evita que um atacante queime a cota de todo um NAT).
 *
 * @param {{ limiter: object, keyBy?: (request: object) => string }} options
 */
function rateLimitBy({ limiter, keyBy }) {
  return function rateLimitMiddleware(request, response, next) {
    const clientIp = rateLimit.getClientIp(request);

    // Tráfego interno/teste não é limitado — mesmo critério do login.
    if (rateLimit.isLocalRequest(clientIp)) {
      return next();
    }

    const key = keyBy ? keyBy(request) : clientIp;
    const { allowed, resetMs } = limiter.check(key);

    if (!allowed) {
      throw new TooManyRequestsError({
        message: "Muitas requisições. Tente novamente mais tarde.",
        action: "Aguarde alguns minutos antes de tentar novamente.",
        retryAfterSeconds: Math.ceil(resetMs / 1000),
      });
    }

    return next();
  };
}

/**
 * Mesma política de `rateLimitBy`, para rotas do App Router.
 *
 * Ali o manipulador é `(request) => Response` — não existe a tríade
 * (request, response, next) —, então em vez de chamar `next()` a função lança
 * `TooManyRequestsError` e deixa `onRouterErrorHandler` traduzir.
 *
 * `keyBy` recebe a `request` e deve devolver o identificador do consumidor.
 * Quando o abuso acompanha a conta (e não o IP), o chamador passa o `id` do
 * usuário — o IP sozinho puniria todo mundo atrás do mesmo NAT.
 *
 * @param {{ limiter: object, request: object, keyBy?: (request: object) => string }} options
 */
export function rateLimitRequest({ limiter, request, keyBy }) {
  const clientIp = rateLimit.getClientIpFromWebRequest(request);

  // Tráfego interno/teste não é limitado — mesmo critério do login.
  if (rateLimit.isLocalRequest(clientIp)) return;

  const key = keyBy ? keyBy(request) : clientIp;
  const { allowed, resetMs } = limiter.check(key);

  if (!allowed) {
    throw new TooManyRequestsError({
      message: "Muitas requisições. Tente novamente mais tarde.",
      action: "Aguarde alguns minutos antes de tentar novamente.",
      retryAfterSeconds: Math.ceil(resetMs / 1000),
    });
  }
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
  getAnonymousUser,
  anonymousCan,
  rateLimitBy,
  rateLimitRequest,
  injectAuthenticatedUser,
  injectApiUser,
  onErrorHandler,
  onRouterErrorHandler,
};

export default controller;
