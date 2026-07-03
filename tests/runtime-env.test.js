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

test("loadEnvironmentFiles can load a shared master env file via an explicit path", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-runtime-"));
  const masterEnvFile = path.join(tempDir, "master.env");
  fs.writeFileSync(masterEnvFile, "LUMI_BRIDGE_SECRET=from-master\n");
  fs.writeFileSync(path.join(tempDir, ".env"), "OPENROUTER_API_KEY=abc123\n");

  const env = {NODE_ENV: "development", LUMI_ENV_FILE: masterEnvFile};
  const loadedFiles = loadEnvironmentFiles(tempDir, env);

  assert.equal(env.LUMI_BRIDGE_SECRET, "from-master");
  assert.equal(env.OPENROUTER_API_KEY, "abc123");
  assert.ok(loadedFiles.some(file => file.path === masterEnvFile));
  assert.ok(loadedFiles.some(file => file.path.endsWith(".env")));
});

test("tool execution policy reads env values after files are loaded", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-runtime-"));
  fs.writeFileSync(path.join(tempDir, ".env"), "LUMI_ALLOW_LOCAL_TOOL_EXECUTION=true\nLUMI_ALLOWED_TOOL_COMMANDS=python\n");

  const env = process.env;
  env.NODE_ENV = "development";
  loadEnvironmentFiles(tempDir, env);
  delete require.cache[require.resolve("../dist/lumi-tools")];

  const {getExecutionPolicySnapshot} = require("../dist/lumi-tools");
  const snapshot = getExecutionPolicySnapshot();

  assert.equal(snapshot.localToolExecutionEnabled, true);
  assert.ok(snapshot.allowedCommands.includes("python"));
});
