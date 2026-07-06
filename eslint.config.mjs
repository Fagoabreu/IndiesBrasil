// eslint.config.mjs
import js from "@eslint/js";
import globals from "globals";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import css from "@eslint/css";
import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import next from "eslint-config-next";
import jest from "eslint-plugin-jest";
import prettier from "eslint-config-prettier";
import primerReact from "eslint-plugin-primer-react";

// 👉 regra resolvida: criar constante nomeada
const config = [
  js.configs.recommended,

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
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error",
    },
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  ...next,
  ...nextVitals,

  {
    files: ["**/*.json"],
    plugins: { json },
    language: "json/json",
    extends: ["json/recommended"],
    ignores: ["package-lock.json"],
  },
  {
    files: ["**/*.jsonc"],
    plugins: { json },
    language: "json/jsonc",
    extends: ["json/recommended"],
  },
  {
    files: ["**/*.json5"],
    plugins: { json },
    language: "json/json5",
    extends: ["json/recommended"],
  },
  {
    files: ["**/*.md"],
    plugins: { markdown },
    language: "markdown/gfm",
    extends: ["markdown/recommended"],
  },
  {
    files: ["**/*.css"],
    plugins: { css },
    language: "css/css",
    extends: ["css/recommended"],
  },

  // Prettier desativa regras conflitantes
  prettier,
  // Pastas ignoradas
  {
    ignores: ["node_modules", ".next", "dist", "coverage", "infra/**/*.js"],
  },
];

export default config;
