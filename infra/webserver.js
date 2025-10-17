function getOrigin() {
  if (["test", "development"].includes(process.env.NODE_ENV)) {
    return "https://localhost:3000";
  }

  if (process.env.VERCEL_ENV === "preview") {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "https://jogos.social.br";
}

const webserver = {
  origin: getOrigin(),
};
export default webserver;
