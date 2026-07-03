const assert = require("assert/strict");
const {test} = require("node:test");

const {buildTrainingResourceAnalysis} = require("../dist/lumi-training-resources");

test("training resource analysis accepts a single string or mixed-case resource IDs", () => {
  const fromString = buildTrainingResourceAnalysis({resources: "YUANBAO"});
  const fromArray = buildTrainingResourceAnalysis({resources: ["YUANBAO"]});

  assert.deepEqual(fromString.resources.map(resource => resource.id), ["yuanbao"]);
  assert.deepEqual(fromArray.resources.map(resource => resource.id), ["yuanbao"]);
});

test("training resource analysis accepts object-style resource IDs", () => {
  const analysis = buildTrainingResourceAnalysis({resources: [{id: "YUANBAO"}]});

  assert.deepEqual(analysis.resources.map(resource => resource.id), ["yuanbao"]);
});

test("training resource analysis accepts a single object selector", () => {
  const analysis = buildTrainingResourceAnalysis({resources: {id: "YUANBAO"}});

  assert.deepEqual(analysis.resources.map(resource => resource.id), ["yuanbao"]);
});

test("training resource analysis accepts object selectors with resourceId property", () => {
  const analysis = buildTrainingResourceAnalysis({resources: {resourceId: "YUANBAO"}});

  assert.deepEqual(analysis.resources.map(resource => resource.id), ["yuanbao"]);
});

test("free model repositories are registered in the training resource catalog", () => {
  const analysis = buildTrainingResourceAnalysis({resources: ["sharegpt-4o-image", "uniworld-v1-nf4", "qwen3-omni-30b-a3b-thinking-awq-8bit", "qwen2.5-omni-3b-gguf"]});
  const resourceIds = analysis.resources.map(resource => resource.id);

  assert.deepEqual(resourceIds, [
    "sharegpt-4o-image",
    "uniworld-v1-nf4",
    "qwen3-omni-30b-a3b-thinking-awq-8bit",
    "qwen2.5-omni-3b-gguf",
  ]);
  assert.equal(analysis.resources[0].category, "model");
  assert.match(analysis.resources[0].url, /github\.com\/FreedomIntelligence\/ShareGPT-4o-Image/);
});
