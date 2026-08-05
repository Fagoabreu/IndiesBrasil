import bcryptjs from "bcryptjs";

const PEPPER = process.env.PEPPER;

if (!PEPPER && process.env.NODE_ENV === "production") {
  throw new Error("PEPPER environment variable is required in production");
}

async function hash(password) {
  const rounds = getNumberOdRounds();
  return await bcryptjs.hash(password + (PEPPER || ""), rounds);
}

function getNumberOdRounds() {
  return process.env.NODE_ENV === "production" ? 14 : 1;
}

async function compare(providedPassword, storedPassword) {
  return await bcryptjs.compare(providedPassword + (PEPPER || ""), storedPassword);
}

const password = {
  hash,
  compare,
};

export default password;
