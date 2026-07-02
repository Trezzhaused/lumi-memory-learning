const assert = require("assert/strict");
const {test} = require("node:test");

const {buildAutonomyPlan, buildComparativeResearchContext} = require("../dist/lumi-autonomy");

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
