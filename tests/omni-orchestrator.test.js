const test = require('node:test');
const assert = require('node:assert/strict');

const {buildOmniMediaPlan} = require('../dist/lumi-omni.js');

test('buildOmniMediaPlan creates a shared-state multimodal workflow', () => {
  const plan = buildOmniMediaPlan('Create a cinematic 3D character intro for a cyberpunk music video with dramatic SFX.');

  assert.equal(plan.prompt, 'Create a cinematic 3D character intro for a cyberpunk music video with dramatic SFX.');
  assert.equal(plan.sharedState.style, 'cinematic');
  assert.equal(plan.sharedState.bpm, 120);
  assert.ok(plan.steps.some(step => step.id === 'brief'));
  assert.ok(plan.steps.some(step => step.id === 'visual'));
  assert.ok(plan.steps.some(step => step.id === 'asset'));
  assert.ok(plan.steps.some(step => step.id === 'audio'));
  assert.ok(plan.steps.some(step => step.id === 'video'));
});
