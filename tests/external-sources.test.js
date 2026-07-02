const assert = require("assert/strict");
const {execFileSync} = require("node:child_process");
const path = require("node:path");
const {test} = require("node:test");

const {buildExternalBrowserSourceContext, getExternalBrowserSources, queryExternalBrowserSource} = require("../dist/lumi-external-sources");

test("Yuanbao is catalogued as the Tencent browser source", () => {
  const sources = getExternalBrowserSources();
  const yuanbao = sources.find(source => source.id === "yuanbao");

  assert.ok(yuanbao);
  assert.equal(yuanbao.name, "Yuanbao (Tencent)");
  assert.equal(yuanbao.category, "chat");
  assert.equal(yuanbao.backend, "browser-automation");
});

test("unknown external browser sources fail cleanly", async () => {
  const result = await queryExternalBrowserSource("not-a-real-source", "summarize this request");

  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
  assert.equal(result.usedBackend, "manual");
  assert.match(result.error, /Unknown external browser source/i);
});

test("Yuanbao lookups are case-insensitive", async () => {
  const result = await queryExternalBrowserSource("YUANBAO", "summarize this request");

  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(result.usedBackend, "manual");
  assert.equal(result.sourceId, "yuanbao");
  assert.match(result.error, /No browser automation endpoint is configured/i);
});

test("source planning accepts mixed-case source IDs", () => {
  const plan = require("../dist/lumi-external-sources").planExternalBrowserSources(["YUANBAO"]);

  assert.deepEqual(plan.requestedSources, ["yuanbao"]);
  assert.equal(plan.sources[0].id, "yuanbao");
});

test("source planning accepts a single source string", () => {
  const plan = require("../dist/lumi-external-sources").planExternalBrowserSources("YUANBAO");

  assert.deepEqual(plan.requestedSources, ["yuanbao"]);
  assert.equal(plan.sources[0].id, "yuanbao");
});

test("unknown source selections return no sources", () => {
  const plan = require("../dist/lumi-external-sources").planExternalBrowserSources(["not-a-real-source"]);
  const context = buildExternalBrowserSourceContext(["not-a-real-source"]);

  assert.deepEqual(plan.requestedSources, []);
  assert.deepEqual(plan.sources, []);
  assert.equal(context, null);
});

test("prompt enhancement includes Yuanbao source context", () => {
  const script = [
    "const {enhancePrompt} = require('./dist/lumi');",
    "enhancePrompt('Research a fresh angle for a coding workflow', 'engineering', ['YUANBAO']).then(result => {",
    "  process.stdout.write(JSON.stringify({content: result.enhancedMessages[0].content}));",
    "}).catch(error => {",
    "  process.stderr.write(String(error));",
    "  process.exitCode = 1;",
    "}).finally(() => {",
    "  for (const handle of process._getActiveHandles()) {",
    "    if (handle && handle.constructor && ['Timeout', 'Immediate'].includes(handle.constructor.name)) {",
    "      clearInterval(handle);",
    "      clearTimeout(handle);",
    "    }",
    "  }",
    "  process.exit(process.exitCode || 0);",
    "});",
  ].join("\n");
  const output = execFileSync(process.execPath, ["-e", script], {
    cwd: path.join(__dirname, ".."),
    encoding: "utf8",
  });
  const payload = JSON.parse(output);

  assert.match(payload.content, /External browser-based source workflow:/i);
  assert.match(payload.content, /Yuanbao \(Tencent\)/i);
});
