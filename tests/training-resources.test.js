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
