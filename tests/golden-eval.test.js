const assert = require("assert/strict");
const {readFileSync} = require("node:fs");
const path = require("node:path");
const {test} = require("node:test");

const {evaluateGuardrailRequest, normalizeGuardedResponse} = require("../dist/lumi-guardrails");
const cases = JSON.parse(readFileSync(path.join(__dirname, "golden-tutor-cases.json"), "utf8"));

for (const testCase of cases) {
  test(`guardrails: ${testCase.id}`, () => {
    const decision = evaluateGuardrailRequest(testCase.input);
    assert.equal(decision.action, testCase.expectedAction);

    if (testCase.expectedAction === "allow") {
      assert.equal(decision.shouldCallModel, true);
      const output = normalizeGuardedResponse(JSON.stringify({
        assistantReply: "Approved tutoring response.",
        safetyState: "safe",
        guardrailAction: "allow",
      }));
      assert.equal(output.action, "allow");
      assert.equal(output.safetyState, "safe");
    } else {
      assert.equal(decision.shouldCallModel, false);
      assert.match(decision.fallbackContent, /training content/i);
    }
  });
}
