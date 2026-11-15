const dotenv = require("dotenv");
dotenv.config({
  path: ".env.development",
});
const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: ".",
});
const jestConfig = createJestConfig({
  moduleDirectories: ["node_modules", "<rootDir>"],
  testTimeout: 60000,
});

// node-pg-migrate@8.x is ESM-only. next/jest's default transformIgnorePatterns
// exclude it. We intercept the resolved config and inject node-pg-migrate
// (and its dependency glob) into the allowlist of the first two patterns.
//
// `marked` entra pelo mesmo motivo: a versão 18 publica só ESM (`type: module`,
// `main: lib/marked.esm.js`). Sem isso, o teste de `lib/markdown.js` falha com
// "Cannot use import statement outside a module" — e só o teste, nunca o app,
// porque o Next transpila `node_modules` no bundle.
const originalConfigFn = jestConfig;
const EXTRA_PACKAGES = "node-pg-migrate|glob|marked|";

module.exports = async () => {
  const config = await originalConfigFn();
  config.transformIgnorePatterns = config.transformIgnorePatterns.map((pattern) => pattern.replace(/\(\?!\(/, `(?!(${EXTRA_PACKAGES}`));
  return config;
};
