import bcryptjs from "bcryptjs";

/**
 * Returns the PEPPER secret. Throws only when actually invoked at runtime
 * (not at module import time), avoiding build-time failures in CI/Docker
 * where PEPPER is injected via secrets only at runtime.
 */
function getPepper() {
  const pepper = process.env.PEPPER;
  if (!pepper && process.env.NODE_ENV === "production") {
    throw new Error("PEPPER environment variable is required in production");
  }
  return pepper || "";
}

async function hash(password) {
  const rounds = getNumberOfRounds();
  return await bcryptjs.hash(password + getPepper(), rounds);
}

/**
 * Custo do bcrypt. Só o ambiente de TESTE usa 1 round (velocidade da suíte);
 * qualquer outro — inclusive dev e staging/homolog — usa o custo real. Antes
 * a condição era `NODE_ENV === "production" ? 14 : 1`, o que deixava qualquer
 * ambiente com NODE_ENV diferente de "production" com hash trivial.
 * PASSWORD_HASH_ROUNDS permite reduzir o custo localmente, de forma explícita.
 */
function getNumberOfRounds() {
  const override = Number.parseInt(process.env.PASSWORD_HASH_ROUNDS ?? "", 10);
  if (!Number.isNaN(override) && override > 0) {
    return override;
  }
  return process.env.NODE_ENV === "test" ? 1 : 14;
}

async function compare(providedPassword, storedPassword) {
  return await bcryptjs.compare(providedPassword + getPepper(), storedPassword);
}

const password = {
  hash,
  compare,
};

export default password;
