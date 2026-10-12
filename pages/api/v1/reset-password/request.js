import user from "@/models/user";
import activation from "@/models/activation";
import { normalizeCpf } from "@/lib/cpf";

import { createRouter } from "next-connect";
import controller from "@/infra/controller";
import rateLimit from "lib/rate-limit.js";
import { NotFoundError } from "@/infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .post(controller.rateLimitBy({ limiter: rateLimit.limiters.reset }), controller.canRequest("create:session"), postHandler)
  .handler(controller.errorHandlers);

async function postHandler(request, response) {
  const userInputValues = request.body;
  try {
    const resetUser = await user.findOneByEmail(userInputValues.email);

    // A comparação normaliza **os dois lados**.
    //
    // Antes era `resetUser.cpf === userInputValues.cpf`, e isso falhava em
    // silêncio: o banco devolvia o CPF sem máscara (e era `NUMERIC`, então
    // também sem o zero à esquerda) e o usuário digita ou cola o CPF como ele
    // aparece no documento — `012.345.678-90`. A comparação não casava, a rota
    // respondia a mensagem genérica de sucesso e **nenhum e-mail era enviado**.
    // Quem dependia do reset não tinha como saber que o pedido não foi aceito.
    //
    // Normalizar os dois lados faz "012.345.678-90", "01234567890" e
    // "012 345 678 90" serem o mesmo documento — ver `lib/cpf.js`.
    const cpfConfere = resetUser && normalizeCpf(resetUser.cpf) === normalizeCpf(userInputValues.cpf);

    if (cpfConfere) {
      // `reset`, e não o padrão `activation`: a finalidade é conferida em
      // `changePasswordByToken`, e um token de ativação não troca senha.
      const resetPasswordToken = await activation.create(resetUser.id, activation.TOKEN_PURPOSE.RESET);
      await activation.sendPasswordEmailToUser(resetUser, resetPasswordToken);
    }
  } catch (error) {
    if (!(error instanceof NotFoundError)) {
      throw error;
    }
  }

  return response.status(200).json({
    message: "Se o email cadastrado existir junto ao CPF, enviaremos instruções.",
  });
}
