// eslint.config.mjs
import js from "@eslint/js";
import next from "eslint-config-next";
import jest from "eslint-plugin-jest";
import prettier from "eslint-config-prettier";
import primerReact from "eslint-plugin-primer-react";

// 👉 regra resolvida: criar constante nomeada
const config = [
  js.configs.recommended,

  ...next,

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
  },

  // Prettier desativa regras conflitantes
  prettier,

  // Regras globais da aplicação
  {
    files: ["**/*.{js,jsx}"],
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error",
    },
  },

  // Pastas ignoradas
  {
    ignores: ["node_modules", ".next", "dist", "coverage", "infra/**/*.js"],
  },
];

export default config;
