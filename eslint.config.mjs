// eslint.config.mjs
import js from "@eslint/js";
import globals from "globals";
import nextVitals from "eslint-config-next/core-web-vitals";
import next from "eslint-config-next";
import jest from "eslint-plugin-jest";
import prettier from "eslint-config-prettier";
import primerReact from "eslint-plugin-primer-react";

// 👉 regra resolvida: criar constante nomeada
const config = [
  // Primer React Lint — versão recomendada pela documentação
  {
    plugins: {
      "primer-react": primerReact,
    },
    rules: {
      ...primerReact.configs.recommended.rules,
    },
  },

  // Jest config
  {
    files: ["tests/**/*.js", "tests/**/*.jsx", "**/*.test.js", "**/*.spec.js"],
    plugins: { jest },
    languageOptions: {
      globals: {
        describe: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        beforeEach: "readonly",
        afterAll: "readonly",
        afterEach: "readonly",
        jest: "readonly",
      },
    },
    rules: {
      ...jest.configs.recommended.rules,
    },
    ...jest.configs["flat/recommended"],
  },

  // Regras globais da aplicação
  {
    files: ["**/*.{js,jsx}"],
    ...js.configs.recommended,
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": "warn",
      "no-undef": "error",
    },
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  ...next,
  ...nextVitals,

  // Prettier desativa regras conflitantes
  prettier,
  // Pastas ignoradas
  {
    ignores: [
      "node_modules",
      ".next",
      "dist",
      "coverage",
      "infra/**/*.js",
      ".deepseek/",
      ".vscode/",
      "**/*.json",
      "**/*.jsonc",
      "**/*.json5",
      "**/*.md",
      "**/*.css",
    ],
  },
];

export default config;
