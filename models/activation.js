import email from "infra/email.js";

async function sendEmailToUser(user) {
  await email.send({
    from: "IndiesBrasil <contato@indies.com.br>",
    to: user.email,
    subject: "Ative seu cadastro no IndieX!",
    text: `${user.username}, clique no link abaixo para finalizar o cadastro

https://link...

Atenciosamente
Equipe Indies Brasil`,
  });
}

const activation = {
  sendEmailToUser,
};

export default activation;
