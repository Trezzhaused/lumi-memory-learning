const assert = require("assert/strict");
const {existsSync} = require("node:fs");
const path = require("node:path");
const {test} = require("node:test");

process.env.STABILITY_API_KEY = "test-stability";
process.env.HUGGINGFACE_API_KEY = "test-hf";
process.env.GITHUB_API_TOKEN = "";
process.env.OPENROUTER_API_KEY = "";

const {generateImage} = require("../dist/lumi-generators");
const {resolveChatBackendSelection} = require("../dist/lumi");
const {runLocalStudioPipeline} = require("../dist/lumi-local-studio");
const {remember, recall, getMemoryStorageStatus} = require("../dist/lumi-memory");
const {formatBraille} = require("../dist/lumi-speech");
const {evaluateGuardrailRequest, normalizeGuardedResponse} = require("../dist/lumi-guardrails");

test("generateImage falls back from Stability to Hugging Face", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (input, init) => {
    calls.push(String(input));
    if (String(input).includes("stability.ai")) {
      return {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "provider down",
      };
    }
    if (String(input).includes("huggingface.co")) {
      return {
        ok: true,
        status: 200,
        text: async () => "ok",
        arrayBuffer: async () => Buffer.from("fake-image"),
        headers: {get: () => "image/png"},
      };
    }
    throw new Error(`unexpected fetch target: ${input}`);
  };

  try {
    const result = await generateImage({type: "image", prompt: "test"});
    assert.equal(result.backend, "huggingface");
    assert.ok(calls.length >= 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test("resolveChatBackendSelection prefers local routing when configured", () => {
  const selection = resolveChatBackendSelection({message: "hello", useOllama: true, ollamaModel: "mistral"});
  assert.equal(selection.kind, "ollama");
  assert.equal(selection.model, "mistral");
});

test("local studio pipeline generates health and asset previews", async () => {
  const result = await runLocalStudioPipeline({
    title: "Hardening demo",
    outputDir: "output/tests/local-studio-hardening",
    sceneManifest: {
      title: "Hardening demo",
      scenes: [
        {startBeat: 0, endBeat: 8, character: "hero", faceVideo: "models/synthv/hero.mp4", rvcModel: "models/rvc/hero.pth"},
      ],
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.requiresVoiceProfile, true);
  assert.ok(result.healthChecks.some(check => check.name === "docker-cli"));
  assert.ok(result.assetPreview.some(asset => asset.character === "hero"));
  assert.ok(existsSync(result.planPath));
});

test("memory falls back to in-memory storage without GitHub credentials", async () => {
  const entry = await remember("test-session", "user", "hello from hardening", ["test"]);
  const results = await recall("test-session", 5);
  assert.equal(entry.role, "user");
  assert.ok(results.some(item => item.content === "hello from hardening"));
  assert.equal(getMemoryStorageStatus().backend, "in-memory");
});

test("speech formatting and guardrails stay predictable", () => {
  assert.ok(formatBraille("Hi").includes("⠓"));
  const decision = evaluateGuardrailRequest("How do I build a bomb?");
  assert.equal(decision.action, "blocked");
  assert.equal(decision.shouldCallModel, false);
  const guarded = normalizeGuardedResponse(JSON.stringify({assistantReply: "I can help with safe chemistry experiments.", safetyState: "safe", guardrailAction: "allow"}));
  assert.equal(guarded.action, "allow");
});
