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
  const rounds = getNumberOdRounds();
  return await bcryptjs.hash(password + getPepper(), rounds);
}

function getNumberOdRounds() {
  return process.env.NODE_ENV === "production" ? 14 : 1;
}

async function compare(providedPassword, storedPassword) {
  return await bcryptjs.compare(providedPassword + getPepper(), storedPassword);
}

const password = {
  hash,
  compare,
};

export default password;
