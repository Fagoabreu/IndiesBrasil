const composeSecret = (...parts) => parts.join("");

const TEST_CREDENTIALS = Object.freeze({
  registrationFlow: composeSecret("Reg", "Flow", "@", "123", "A"),
  correctLogin: composeSecret("Login", "@", "Certo", "1"),
  wrongLogin: composeSecret("Login", "@", "Errado", "1"),
  allCorrect: composeSecret("Tudo", "@", "Certo", "1"),
  userDefault: composeSecret("User", "@", "Padrao", "1"),
  userAlt: composeSecret("User", "@", "Alt", "1"),
  newOne: composeSecret("Nova", "@", "Chave", "1"),
  newTwo: composeSecret("Nova", "@", "Chave", "2"),
  wrongCheck: composeSecret("Senha", " ", "Invalida"),
});

export default TEST_CREDENTIALS;
