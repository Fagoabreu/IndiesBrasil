import email from "infra/email.js";
import orchestrator from "tests/orchestrator";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.deleteAllEmails();
});

describe("infra/email.js", () => {
  test("send()", async () => {
    await email.send({
      from: "IndiesBrasil <contato@indies.com.br>",
      to: "test@indies.com.br",
      subject: "Test email",
      text: "This is a test email.",
    });

    await email.send({
      from: "IndiesBrasil <contato@indies.com.br>",
      to: "test@indies.com.br",
      subject: "Ultimo email enviado",
      text: "Corpo ultimo email.",
    });

    const lastmail = await orchestrator.getLastEmail();
    expect(lastmail.sender).toBe("<contato@indies.com.br>");
    expect(lastmail.recipients[0]).toBe("<test@indies.com.br>");
    expect(lastmail.subject).toBe("Ultimo email enviado");
    expect(lastmail.text).toBe("Corpo ultimo email.\n");
  });
});
