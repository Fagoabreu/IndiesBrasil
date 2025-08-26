import email from "infra/email.js";

beforeAll(async () => {
  await email.clear();
});

describe("infra/email.js", () => {
  test("send()", async () => {
    await email.send({
      from: "IndiesBrasil <contato@indies.com.br>",
      to: "test@indies.com.br",
      subject: "Test email",
      text: "This is a test email.",
    });
  });
});
