import user from "models/user";
import password from "models/password";
import rateLimit from "lib/rate-limit";
import moderation from "models/moderation.js";
import { NotFoundError, UnauthorizedError, TooManyRequestsError, ForbiddenError } from "infra/errors.js";

async function getUser(providedEmail, providedPassword, request) {
  try {
    if (request) {
      const clientIp = rateLimit.getClientIp(request);

      // Skip rate limiting for local requests (tests / local dev without reverse proxy).
      // In production, nginx always sets X-Forwarded-For to the real client IP,
      // so loopback addresses only appear from internal/test traffic.
      const isLocalRequest = clientIp === "127.0.0.1" || clientIp === "::1" || clientIp === "::ffff:127.0.0.1";
      if (!isLocalRequest) {
        const { allowed, remaining, resetMs } = rateLimit.check(clientIp);

        if (!allowed) {
          throw new TooManyRequestsError({
            message: "Muitas tentativas de login. Tente novamente em alguns minutos.",
            action: "Aguarde antes de tentar novamente.",
            retryAfterSeconds: Math.ceil(resetMs / 1000),
          });
        }

        if (remaining <= 2) {
          // Log low remaining attempts for monitoring.
          console.warn(`[rate-limit] Login attempts running low for IP ${clientIp}: ${remaining} remaining`);
        }
      }
    }

    const storedUser = await findUserByEmail(providedEmail);
    await validatePassword(providedPassword, storedUser.password);

    if (await moderation.isBlocked("user", storedUser.id)) {
      throw new ForbiddenError({
        message: "Sua conta está temporariamente suspensa.",
        action: "Entre em contato com o suporte para mais informações.",
      });
    }

    return storedUser;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw new UnauthorizedError({
        message: "Dados de autenticação não conferem.",
        action: "Verifique se os dados enviados estão corretos",
      });
    }
    throw error;
  }

  async function findUserByEmail(providedEmail) {
    let storedUser;
    try {
      storedUser = await user.findOneByEmail(providedEmail);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new UnauthorizedError({
          message: "Senha não confere.",
          action: "Verifique se este dado está correto",
        });
      }

      throw error;
    }
    return storedUser;
  }

  async function validatePassword(providedPassword, storedPassword) {
    const correctPasswordMatch = await password.compare(providedPassword, storedPassword);
    if (!correctPasswordMatch) {
      throw new UnauthorizedError({
        message: "Senha não confere.",
        action: "Verifique se este dado está correto",
      });
    }
  }
}

const authentication = {
  getUser,
};

export default authentication;
