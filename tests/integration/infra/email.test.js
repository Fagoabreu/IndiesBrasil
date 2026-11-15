import email from "infra/email.js";
import orchestrator from "tests/orchestrator";
import { EMAIL_FROM, EMAIL_FROM_ADDRESS } from "@/lib/email/sender";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.deleteAllEmails();
});

/**
 * O remetente vem de `lib/email/sender.js`, não de uma string literal: era a
 * terceira cópia do endereço (as outras duas em `models/activation.js` e
 * `models/store.js`) e, na migração de marca, o teste continuaria verde
 * enquanto os e-mails saíssem com outro nome ou outro endereço.
 */
describe("infra/email.js", () => {
  test("send()", async () => {
    await email.send({
      from: EMAIL_FROM,
      to: "test@indies.com.br",
      subject: "Test email",
      text: "This is a test email.",
    });

    await email.send({
      from: EMAIL_FROM,
      to: "test@indies.com.br",
      subject: "Ultimo email enviado",
      text: "Corpo ultimo email.",
    });

    const lastmail = await orchestrator.getLastEmail();
    expect(lastmail.sender).toBe(`<${EMAIL_FROM_ADDRESS}>`);
    expect(lastmail.recipients[0]).toBe("<test@indies.com.br>");
    expect(lastmail.subject).toBe("Ultimo email enviado");
    expect(lastmail.text).toBe("Corpo ultimo email.\n");
  });
});
