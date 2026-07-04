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

test("training resource analysis resolves GitHub URLs and repo-style selectors", () => {
  const fromUrl = buildTrainingResourceAnalysis({resources: "https://github.com/FreedomIntelligence/ShareGPT-4o-Image"});
  const fromSlug = buildTrainingResourceAnalysis({resources: "FreedomIntelligence/ShareGPT-4o-Image"});
  const fromObject = buildTrainingResourceAnalysis({resources: [{url: "https://github.com/openai/gpt-oss"}]});

  assert.deepEqual(fromUrl.resources.map(resource => resource.id), ["sharegpt-4o-image"]);
  assert.deepEqual(fromSlug.resources.map(resource => resource.id), ["sharegpt-4o-image"]);
  assert.deepEqual(fromObject.resources.map(resource => resource.id), ["gpt-oss"]);
});

test("training resource analysis resolves Hugging Face URLs with repository suffixes", () => {
  const fromTreeUrl = buildTrainingResourceAnalysis({resources: "https://huggingface.co/wikeeyang/UniWorld-V1-NF4/tree/main"});
  const fromResolveUrl = buildTrainingResourceAnalysis({resources: "https://huggingface.co/cyankiwi/Qwen3-Omni-30B-A3B-Thinking-AWQ-8bit/resolve/main/README.md"});

  assert.deepEqual(fromTreeUrl.resources.map(resource => resource.id), ["uniworld-v1-nf4"]);
  assert.deepEqual(fromResolveUrl.resources.map(resource => resource.id), ["qwen3-omni-30b-a3b-thinking-awq-8bit"]);
});

test("training resource analysis accepts nested object selectors", () => {
  const analysis = buildTrainingResourceAnalysis({resources: [{resource: {resourceId: "YUANBAO"}}]});

  assert.deepEqual(analysis.resources.map(resource => resource.id), ["yuanbao"]);
});

test("training resource analysis falls back to resourceId when id is empty", () => {
  const analysis = buildTrainingResourceAnalysis({resources: {id: "", resourceId: "YUANBAO"}});

  assert.deepEqual(analysis.resources.map(resource => resource.id), ["yuanbao"]);
});

test("training resource analysis accepts selector values nested in arrays", () => {
  const analysis = buildTrainingResourceAnalysis({resources: [{resource: [{resourceId: "YUANBAO"}]}]});

  assert.deepEqual(analysis.resources.map(resource => resource.id), ["yuanbao"]);
});

test("training resource analysis accepts selector aliases with punctuation separators", () => {
  const analysis = buildTrainingResourceAnalysis({resources: [{resource: {"resource-id": "YUANBAO"}}]});

  assert.deepEqual(analysis.resources.map(resource => resource.id), ["yuanbao"]);
});

test("training resource analysis accepts explicit resourceValue aliases", () => {
  const analysis = buildTrainingResourceAnalysis({resources: [{resourceValue: "YUANBAO"}]});

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

test("training resource analysis preserves the requested order for explicit resource selections", () => {
  const analysis = buildTrainingResourceAnalysis({resources: ["qwen2.5-omni-3b-gguf", "sharegpt-4o-image"]});

  assert.deepEqual(analysis.resources.map(resource => resource.id), [
    "qwen2.5-omni-3b-gguf",
    "sharegpt-4o-image",
  ]);
});
