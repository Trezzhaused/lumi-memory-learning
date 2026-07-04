const assert = require("assert/strict");
const {test} = require("node:test");

const {buildEmbeddedKnowledgeContext} = require("../dist/lumi-knowledge-pack");

test("embedded knowledge pack includes video, audio, skills, K-12 Q&A, and DoD training capabilities", () => {
  const context = buildEmbeddedKnowledgeContext();

  assert.match(context, /Video generation and media production/i);
  assert.match(context, /Audio generation and voice workflows/i);
  assert.match(context, /Skills, learning loops, and reusable capabilities/i);
  assert.match(context, /K-12 Q&A and educational support/i);
  assert.match(context, /DoD \/ AFTC training systems and serious games/i);
});
