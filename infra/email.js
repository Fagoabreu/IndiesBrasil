import nodemailer from "nodemailer";

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
  await transporter.sendMail(mailOptions);
}

async function clear() {
  await fetch("http://localhost:1080/messages", {
    method: "DELETE",
  });
}

const email = {
  send,
  clear,
};

export default email;
