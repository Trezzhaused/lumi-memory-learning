const assert = require("assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {test} = require("node:test");

const {loadEnvironmentFiles} = require("../dist/lumi-runtime");

test("loadEnvironmentFiles loads env files while preserving explicit env values", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-runtime-"));
  fs.writeFileSync(path.join(tempDir, ".env"), "PORT=3001\nLUMI_BRIDGE_SECRET=from-env\n");
  fs.writeFileSync(path.join(tempDir, ".env.production"), "PORT=4001\nOPENROUTER_API_KEY=abc123\n");

  const env = {NODE_ENV: "production", PORT: "7000"};
  const loadedFiles = loadEnvironmentFiles(tempDir, env);

  assert.equal(env.PORT, "7000");
  assert.equal(env.LUMI_BRIDGE_SECRET, "from-env");
  assert.equal(env.OPENROUTER_API_KEY, "abc123");
  assert.ok(loadedFiles.some(file => file.path.endsWith(".env")));
  assert.ok(loadedFiles.some(file => file.path.endsWith(".env.production")));
});

test("loadEnvironmentFiles can rely on a single .env file in production mode", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-runtime-"));
  fs.writeFileSync(path.join(tempDir, ".env"), "PORT=3001\nLUMI_BRIDGE_SECRET=from-env\n");

  const env = {NODE_ENV: "production"};
  const loadedFiles = loadEnvironmentFiles(tempDir, env);

  assert.equal(env.PORT, "3001");
  assert.equal(env.LUMI_BRIDGE_SECRET, "from-env");
  assert.ok(loadedFiles.some(file => file.path.endsWith(".env")));
  assert.ok(!loadedFiles.some(file => file.path.endsWith(".env.production")));
});
