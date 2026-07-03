const assert = require("assert/strict");
const {test} = require("node:test");

const {classifyText} = require("../dist/lumi-classification");

test("heuristic classification emits ranked category probabilities", async () => {
  const result = await classifyText({
    text: "I love this feature and it works great",
    labels: ["positive", "negative", "neutral"],
  });

  assert.equal(result.ok, true);
  assert.equal(result.source, "heuristic-fallback");
  assert.equal(result.labels[0], "positive");
  assert.equal(result.probabilities.positive > result.probabilities.negative, true);
  assert.equal(result.probabilities.positive > result.probabilities.neutral, true);
});

test("single-string labels are normalized for heuristic classification", async () => {
  const result = await classifyText({
    text: "This is a terrible experience",
    labels: "negative",
  });

  assert.equal(result.ok, true);
  assert.equal(result.source, "heuristic-fallback");
  assert.deepEqual(result.labels, ["negative"]);
  assert.equal(result.probabilities.negative > 0, true);
});
