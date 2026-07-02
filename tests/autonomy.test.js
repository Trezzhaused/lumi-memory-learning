const assert = require("assert/strict");
const {existsSync} = require("node:fs");
const path = require("node:path");
const {test} = require("node:test");

const {buildAutonomyPlan, buildComparativeResearchContext, executeSelfDirectedDirective} = require("../dist/lumi-autonomy");

test("research-before-create prompts produce a research-first plan", async () => {
  const plan = buildAutonomyPlan("Create a website like Shopify for a new coffee brand");
  assert.equal(plan.mode, "research-before-create");
  assert.equal(plan.steps[0].kind, "research");
  assert.ok(plan.requiresExternalResearch);
});

test("comparative research context falls back to a structured plan when automation is unavailable", async () => {
  const context = await buildComparativeResearchContext("Create a dashboard like Notion for a local school");
  assert.ok(context);
  assert.match(context, /Comparative research plan/i);
});

test("sovereign autonomy prompts produce a secure self-hosted execution plan", () => {
  const plan = buildAutonomyPlan("Secure my public n8n chat and build a sovereign multi-modal agent mesh with inventory and pricing schema");
  assert.equal(plan.mode, "sovereign-autonomy");
  assert.ok(plan.steps.some(step => /secure|schema|multi-modal|execution/i.test(step.title)));
  assert.ok(plan.safetyNotes.some(note => /authentication/i.test(note)));
});

test("scheduled automation prompts produce a reviewable workflow plan", () => {
  const plan = buildAutonomyPlan("Set up a cron job for daily briefings and a social publishing loop that drafts posts and notifies the owner");
  assert.equal(plan.mode, "scheduled-automation");
  assert.ok(plan.steps.some(step => /state|persistence/i.test(step.title)));
  assert.ok(plan.steps.some(step => /schedule|execution/i.test(step.title)));
  assert.ok(plan.steps.some(step => /approval|review/i.test(step.title)));
  assert.ok(plan.steps.some(step => /artifact/i.test(step.title)));
  assert.ok(plan.steps.some(step => /notification|handoff/i.test(step.title)));
  assert.ok(plan.safetyNotes.some(note => /approval/i.test(note)));
  assert.ok(plan.safetyNotes.some(note => /publishing/i.test(note)));
});

test("finance and maintenance prompts produce a guardrailed audit plan", () => {
  const plan = buildAutonomyPlan("Audit the ledger and scan local files for syntax bugs and maintenance issues");
  assert.equal(plan.mode, "finance-maintenance");
  assert.ok(plan.steps.some(step => /ledger|scan/i.test(step.title)));
  assert.ok(plan.steps.some(step => /execution|workflow/i.test(step.title)));
  assert.ok(plan.steps.some(step => /review/i.test(step.title)));
  assert.ok(plan.safetyNotes.some(note => /approval/i.test(note)));
});

test("self-directed directives create a reviewable local artifact", () => {
  const artifactRoot = path.join(__dirname, "..", ".tmp", "self-directed-tests");
  const result = executeSelfDirectedDirective({
    activeProjects: ["lumi-memory-learning"],
    focus: "audit the local maintenance state and prepare a bounded review note",
    notes: ["Keep the change local and reviewable."],
  }, {workspaceRoot: artifactRoot});

  assert.equal(result.ok, true);
  assert.equal(result.blocked, false);
  assert.ok(result.directive);
  assert.ok(result.artifactPath);
  assert.ok(existsSync(result.artifactPath));
  assert.match(result.message, /Self-directed autonomy report written/i);
});
