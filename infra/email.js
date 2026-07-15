import nodemailer from "nodemailer";
import { ServiceError } from "./errors";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SMTP_HOST,
  port: process.env.EMAIL_SMTP_PORT,
  auth: {
    user: process.env.EMAIL_SMTP_USER,
    pass: process.env.EMAIL_SMTP_PASSWORD,
  },
  secure: process.env.NODE_ENV === "production",
});

async function send(mailOptions) {
  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    throw new ServiceError({
      message: "Erro ao enviar e-mail.",
      action: "Verifique se o serviço de email está disponível",
      cause: error,
      context: mailOptions,
    });
  }
}

const email = {
  send,
};

export default email;
