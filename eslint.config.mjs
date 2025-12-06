// eslint.config.mjs
import js from "@eslint/js";
import next from "eslint-config-next";
import jest from "eslint-plugin-jest";
import prettier from "eslint-config-prettier";

// 👉 regra resolvida: criar constante nomeada
const config = [
  js.configs.recommended,

  ...next,

  // bloco de Jest
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

  prettier,

  {
    files: ["**/*.{js,jsx}"],
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error",
    },
  },

  {
    ignores: ["node_modules", ".next", "dist", "coverage", "infra/**/*.js"],
  },
];

// 👉 agora exportamos a constante nomeada
export default config;
