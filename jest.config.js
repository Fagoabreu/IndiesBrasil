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
const originalConfigFn = jestConfig;
const EXTRA_PACKAGES = "node-pg-migrate|glob|";

module.exports = async () => {
  const config = await originalConfigFn();
  config.transformIgnorePatterns = config.transformIgnorePatterns.map((pattern) => pattern.replace(/\(\?!\(/, `(?!(${EXTRA_PACKAGES}`));
  return config;
};
