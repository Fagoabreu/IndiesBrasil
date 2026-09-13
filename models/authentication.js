import user from "models/user";
import password from "models/password";
import rateLimit from "lib/rate-limit";
import moderation from "models/moderation.js";
import { NotFoundError, UnauthorizedError, TooManyRequestsError, ForbiddenError } from "infra/errors.js";

// Hash bcrypt descartável (custo 14, igual ao de produção), usado apenas para
// gastar o mesmo tempo de CPU quando o e-mail não existe. Não corresponde a
// nenhuma senha real — nenhum login consegue validar contra ele.
const DUMMY_PASSWORD_HASH = "$2b$14$.ZJPco6PSKDcz4tSSV8T6ex6g/ysctUTbVf9EdYDseYSI1JUa0MDO";

async function getUser(providedEmail, providedPassword, request) {
  try {
    if (request) {
      const clientIp = rateLimit.getClientIp(request);

      // Tráfego interno/teste não é limitado. Em produção o nginx sempre
      // define X-Forwarded-For com o IP real, então loopback só aparece de
      // tráfego interno.
      if (!rateLimit.isLocalRequest(clientIp)) {
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
        // Executa um bcrypt de descarte antes de falhar: sem isso, e-mail
        // inexistente responde rápido (sem hash) e e-mail existente responde
        // lento (14 rounds), permitindo enumerar contas válidas pelo tempo
        // de resposta — mesmo com a mensagem genérica.
        await password.compare(providedPassword, DUMMY_PASSWORD_HASH);
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
