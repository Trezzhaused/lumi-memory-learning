const assert = require("assert/strict");
const {test} = require("node:test");

const {getExternalBrowserSources, queryExternalBrowserSource} = require("../dist/lumi-external-sources");

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
