const assert = require("assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {test} = require("node:test");

const {enforceBilling, registerTenant, upgradeBilling} = require("../dist/lumi-tenant");

test("registerTenant creates a workspace, script, and ledger entry", () => {
  const tempDir = path.join(__dirname, "..", ".tmp", `tenant-test-${Date.now()}`);
  process.env.LUMI_TENANT_DATA_DIR = tempDir;

  const result = registerTenant("alpha_leader");
  assert.equal(result.status, "success");
  assert.ok(result.user_id);
  assert.ok(fs.existsSync(path.join(tempDir, "users.json")));
  assert.ok(fs.existsSync(path.join(tempDir, "billing_ledger.json")));
  assert.ok(fs.existsSync(path.join(tempDir, "users", result.user_id, "client_agent.py")));
});

test("enforceBilling deducts credits and upgradeBilling resets them", () => {
  const tempDir = path.join(__dirname, "..", ".tmp", `billing-test-${Date.now()}`);
  process.env.LUMI_TENANT_DATA_DIR = tempDir;

  const user = registerTenant("billing_user");
  const blocked = enforceBilling(user.user_id, "VIDEO_RENDER");
  assert.equal(blocked.status, "UPGRADE_REQUIRED");

  const upgraded = upgradeBilling(user.user_id, "Platinum", 4000);
  assert.equal(upgraded.status, "PASSED");

  const passed = enforceBilling(user.user_id, "VIDEO_RENDER");
  assert.equal(passed.status, "PASSED");
  assert.equal(passed.remaining_credits, 3975);
});
