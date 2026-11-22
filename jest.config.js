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
//
// `@primer/react` e as dependências Lit entram pelo mesmo motivo: o pacote é
// `type: module` e o barril `dist/index.js` importa `@lit-labs/react`, também
// ESM. Sem isso, qualquer teste que renderize um componente do Primer falha com
// "Unexpected token 'export'" — e o app continua funcionando, porque o Next
// transpila `node_modules` no bundle.
const originalConfigFn = jestConfig;
const EXTRA_PACKAGES =
  "node-pg-migrate|glob|marked|@primer/react|@lit-labs/react|@lit/reactive-element|@lit/context|lit|lit-html|lit-element|@github/relative-time-element|@github/tab-container-element|@primer/live-region-element|";

module.exports = async () => {
  const config = await originalConfigFn();
  config.transformIgnorePatterns = config.transformIgnorePatterns.map((pattern) => pattern.replace(/\(\?!\(/, `(?!(${EXTRA_PACKAGES}`));
  return config;
};
