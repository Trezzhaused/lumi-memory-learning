const assert = require("assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {test, afterEach} = require("node:test");

const {classifyProviderError, formatProviderError} = require("../dist/lumi-runtime");
const {generateAudio} = require("../dist/lumi-generators");
const {runLocalStudioPipeline} = require("../dist/lumi-local-studio");
const {remember, recall, search} = require("../dist/lumi-memory");
const {formatBraille, transcribeAudio} = require("../dist/lumi-speech");

const testOutputDir = ".tmp/hardening-test-output";

afterEach(() => {
  try {
    fs.rmSync(path.join(process.cwd(), testOutputDir), {recursive: true, force: true});
  } catch {
    // ignore cleanup failures in test environments
  }
});

test("provider errors are classified with clear categories", () => {
  const issue = classifyProviderError(new Error("OPENROUTER_API_KEY is not configured."), "openrouter");
  assert.equal(issue.category, "missing_credentials");
  assert.equal(issue.retryable, false);
  assert.match(formatProviderError(new Error("timed out"), "nvidia"), /nvidia/i);
});

test("audio generation degrades gracefully without provider credentials", async () => {
  const result = await generateAudio({type: "audio", prompt: "ambient synth"});
  assert.equal(result.backend, "unavailable");
  assert.match(result.text || "", /not available/i);
});

test("local studio pipeline writes manifest and preview metadata", async () => {
  const result = await runLocalStudioPipeline({
    title: "Hardening test",
    audioPath: "input/test.wav",
    outputDir: testOutputDir,
    sceneManifest: {
      title: "Hardening test",
      scenes: [
        {startBeat: 0, endBeat: 8, character: "hero", faceVideo: "models/synthv/hero.mp4", rvcModel: "models/rvc/hero.pth"},
      ],
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.assetPreview.length, 1);
  assert.equal(result.assetPreview[0].character, "hero");
  assert.equal(result.requiresVoiceProfile, true);
  assert.ok(fs.existsSync(result.sceneManifestPath));
  assert.ok(fs.existsSync(result.planPath));
  assert.ok(fs.existsSync(result.scriptPath));
});

test("memory remembers and recalls entries in in-memory fallback mode", async () => {
  await remember("hardening-session", "user", "hello from tests", ["chat", "test"]);
  const results = await recall("hardening-session", 5);
  assert.ok(results.some(entry => entry.content.includes("hello from tests")));
});

test("memory recall and search respect zero limits", async () => {
  await remember("zero-limit-session", "user", "zero limit message", ["limit"]);

  assert.deepEqual(await recall("zero-limit-session", 0), []);
  assert.deepEqual(await search("zero limit message", 0), []);
});

test("speech helpers return a clear fallback and braille output", async () => {
  const transcription = await transcribeAudio("Zm9v", "audio/webm");
  assert.equal(transcription.ok, false);
  assert.match(transcription.error || "", /configured/i);
  assert.equal(formatBraille("hi"), "⠓⠊");
});
