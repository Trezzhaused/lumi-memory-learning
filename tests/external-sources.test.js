const assert = require("assert/strict");
const {execFileSync} = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const {test} = require("node:test");

const {buildExternalBrowserSourceContext, getExternalBrowserSources, planExternalBrowserSources, queryExternalBrowserSource} = require("../dist/lumi-external-sources");

test("Yuanbao is catalogued as the Tencent browser source", () => {
  const sources = getExternalBrowserSources();
  const yuanbao = sources.find(source => source.id === "yuanbao");

  assert.ok(yuanbao);
  assert.equal(yuanbao.name, "Yuanbao (Tencent)");
  assert.equal(yuanbao.category, "chat");
  assert.equal(yuanbao.backend, "browser-automation");
});

test("free Hugging Face media model repositories are catalogued", () => {
  const sources = getExternalBrowserSources();
  const locateAnything = sources.find(source => source.id === "locateanything-3b");
  const preferredQwen = sources.find(source => source.id === "qwen3.6-40b-claude-opus-deckard-heretic-uncensored-thinking");
  const sunnyTeacher = sources.find(source => source.id === "sunnyteacher16b-v2");
  const dyslexiaSimplifier = sources.find(source => source.id === "dyslexia-friendly-text-simplifier");
  const skyReels = sources.find(source => source.id === "skyreels-v2-t2v-14b-540p");
  const audio = sources.find(source => source.id === "mimo-audio-7b-instruct");
  const sharegpt = sources.find(source => source.id === "sharegpt-4o-image");
  const uniworld = sources.find(source => source.id === "uniworld-v1-nf4");
  const qwenOmniThinking = sources.find(source => source.id === "qwen3-omni-30b-a3b-thinking-awq-8bit");
  const qwenOmni3b = sources.find(source => source.id === "qwen2.5-omni-3b-gguf");

  assert.ok(locateAnything);
  assert.equal(locateAnything.category, "research");
  assert.match(locateAnything.url, /huggingface\.co\/nvidia\/LocateAnything-3B/);
  assert.ok(preferredQwen);
  assert.match(preferredQwen.notes, /user-preferred/i);
  assert.ok(sunnyTeacher);
  assert.match(sunnyTeacher.notes, /teaching/i);
  assert.ok(dyslexiaSimplifier);
  assert.match(dyslexiaSimplifier.notes, /accessibility/i);
  assert.ok(skyReels);
  assert.match(skyReels.notes, /video/i);
  assert.ok(audio);
  assert.match(audio.notes, /audio/i);
  assert.ok(sharegpt);
  assert.match(sharegpt.url, /github\.com\/FreedomIntelligence\/ShareGPT-4o-Image/);
  assert.ok(uniworld);
  assert.match(uniworld.url, /huggingface\.co\/wikeeyang\/UniWorld-V1-NF4/);
  assert.ok(qwenOmniThinking);
  assert.match(qwenOmniThinking.url, /huggingface\.co\/cyankiwi\/Qwen3-Omni-30B-A3B-Thinking-AWQ-8bit/);
  assert.ok(qwenOmni3b);
  assert.match(qwenOmni3b.url, /huggingface\.co\/aoiandroid\/Qwen2\.5-Omni-3B-GGUF/);
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

test("source planning accepts object-style source IDs", () => {
  const plan = require("../dist/lumi-external-sources").planExternalBrowserSources([{id: "YUANBAO"}]);

  assert.deepEqual(plan.requestedSources, ["yuanbao"]);
  assert.equal(plan.sources[0].id, "yuanbao");
});

test("source planning accepts a single object selector", () => {
  const plan = require("../dist/lumi-external-sources").planExternalBrowserSources({id: "YUANBAO"});

  assert.deepEqual(plan.requestedSources, ["yuanbao"]);
  assert.equal(plan.sources[0].id, "yuanbao");
});

test("source planning accepts object selectors with sourceId property", () => {
  const plan = require("../dist/lumi-external-sources").planExternalBrowserSources({sourceId: "YUANBAO"});

  assert.deepEqual(plan.requestedSources, ["yuanbao"]);
  assert.equal(plan.sources[0].id, "yuanbao");
});

test("source planning accepts nested object selectors", () => {
  const plan = require("../dist/lumi-external-sources").planExternalBrowserSources([{source: {sourceId: "YUANBAO"}}]);

  assert.deepEqual(plan.requestedSources, ["yuanbao"]);
  assert.equal(plan.sources[0].id, "yuanbao");
});

test("source planning accepts case-insensitive nested selector aliases", () => {
  const plan = require("../dist/lumi-external-sources").planExternalBrowserSources([{source: {SourceId: "YUANBAO"}}]);

  assert.deepEqual(plan.requestedSources, ["yuanbao"]);
  assert.equal(plan.sources[0].id, "yuanbao");
});

test("source planning accepts selector aliases with punctuation separators", () => {
  const plan = require("../dist/lumi-external-sources").planExternalBrowserSources([{source: {"source-id": "YUANBAO"}}]);

  assert.deepEqual(plan.requestedSources, ["yuanbao"]);
  assert.equal(plan.sources[0].id, "yuanbao");
});

test("source planning accepts selector values nested in arrays", () => {
  const plan = require("../dist/lumi-external-sources").planExternalBrowserSources([{source: [{sourceId: "YUANBAO"}]}]);

  assert.deepEqual(plan.requestedSources, ["yuanbao"]);
  assert.equal(plan.sources[0].id, "yuanbao");
});

test("source planning falls back to sourceId when id is empty", () => {
  const plan = require("../dist/lumi-external-sources").planExternalBrowserSources({id: "", sourceId: "YUANBAO"});

  assert.deepEqual(plan.requestedSources, ["yuanbao"]);
  assert.equal(plan.sources[0].id, "yuanbao");
});

test("automation failures are surfaced as structured proxy errors", async () => {
  const previousProxyUrl = process.env.EXTERNAL_BROWSER_PROXY_URL;
  const previousApiUrl = process.env.EXTERNAL_BROWSER_API_URL;
  process.env.EXTERNAL_BROWSER_PROXY_URL = "http://127.0.0.1:1";
  delete process.env.EXTERNAL_BROWSER_API_URL;

  try {
    const result = await queryExternalBrowserSource("yuanbao", "summarize this request");
    assert.equal(result.ok, false);
    assert.equal(result.status, 502);
    assert.equal(result.usedBackend, "proxy");
    assert.match(result.error, /Automation request failed/i);
  } finally {
    if (previousProxyUrl === undefined) {
      delete process.env.EXTERNAL_BROWSER_PROXY_URL;
    } else {
      process.env.EXTERNAL_BROWSER_PROXY_URL = previousProxyUrl;
    }

    if (previousApiUrl === undefined) {
      delete process.env.EXTERNAL_BROWSER_API_URL;
    } else {
      process.env.EXTERNAL_BROWSER_API_URL = previousApiUrl;
    }
  }
});

test("proxy error payloads are surfaced as structured failures", async () => {
  const previousProxyUrl = process.env.EXTERNAL_BROWSER_PROXY_URL;
  const previousApiUrl = process.env.EXTERNAL_BROWSER_API_URL;
  const server = http.createServer((req, res) => {
    res.writeHead(200, {"Content-Type": "application/json"});
    res.end(JSON.stringify({ok: false, error: "Proxy denied"}));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  process.env.EXTERNAL_BROWSER_PROXY_URL = `http://127.0.0.1:${address.port}`;
  delete process.env.EXTERNAL_BROWSER_API_URL;

  try {
    const result = await queryExternalBrowserSource("yuanbao", "summarize this request");
    assert.equal(result.ok, false);
    assert.equal(result.status, 200);
    assert.equal(result.usedBackend, "proxy");
    assert.equal(result.error, "Proxy denied");
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));

    if (previousProxyUrl === undefined) {
      delete process.env.EXTERNAL_BROWSER_PROXY_URL;
    } else {
      process.env.EXTERNAL_BROWSER_PROXY_URL = previousProxyUrl;
    }

    if (previousApiUrl === undefined) {
      delete process.env.EXTERNAL_BROWSER_API_URL;
    } else {
      process.env.EXTERNAL_BROWSER_API_URL = previousApiUrl;
    }
  }
});

test("nested proxy error payloads are surfaced as structured failures", async () => {
  const previousProxyUrl = process.env.EXTERNAL_BROWSER_PROXY_URL;
  const previousApiUrl = process.env.EXTERNAL_BROWSER_API_URL;
  const server = http.createServer((req, res) => {
    res.writeHead(200, {"Content-Type": "application/json"});
    res.end(JSON.stringify({ok: false, error: {message: "Proxy denied by policy"}}));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  process.env.EXTERNAL_BROWSER_PROXY_URL = `http://127.0.0.1:${address.port}`;
  delete process.env.EXTERNAL_BROWSER_API_URL;

  try {
    const result = await queryExternalBrowserSource("yuanbao", "summarize this request");
    assert.equal(result.ok, false);
    assert.equal(result.status, 200);
    assert.equal(result.usedBackend, "proxy");
    assert.equal(result.error, "Proxy denied by policy");
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));

    if (previousProxyUrl === undefined) {
      delete process.env.EXTERNAL_BROWSER_PROXY_URL;
    } else {
      process.env.EXTERNAL_BROWSER_PROXY_URL = previousProxyUrl;
    }

    if (previousApiUrl === undefined) {
      delete process.env.EXTERNAL_BROWSER_API_URL;
    } else {
      process.env.EXTERNAL_BROWSER_API_URL = previousApiUrl;
    }
  }
});

test("source planning preserves the requested order for explicit source selections", () => {
  const plan = planExternalBrowserSources(["qwen2.5-omni-3b-gguf", "sharegpt-4o-image"]);

  assert.deepEqual(plan.requestedSources, [
    "qwen2.5-omni-3b-gguf",
    "sharegpt-4o-image",
  ]);
  assert.deepEqual(plan.sources.map(source => source.id), [
    "qwen2.5-omni-3b-gguf",
    "sharegpt-4o-image",
  ]);
});

test("unknown source selections return no sources", () => {
  const plan = require("../dist/lumi-external-sources").planExternalBrowserSources(["not-a-real-source"]);
  const context = buildExternalBrowserSourceContext(["not-a-real-source"]);

  assert.deepEqual(plan.requestedSources, []);
  assert.deepEqual(plan.sources, []);
  assert.equal(context, null);
});

test("empty selector objects fall back to the default catalog", () => {
  const plan = planExternalBrowserSources([{}]);
  const context = buildExternalBrowserSourceContext([{}]);

  assert.deepEqual(plan.requestedSources, plan.sources.map(source => source.id));
  assert.ok(plan.sources.length > 0);
  assert.ok(context);
  assert.match(context, /External browser-based source workflow:/i);
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

test("prompt enhancement accepts object-style source selectors", () => {
  const script = [
    "const {enhancePrompt} = require('./dist/lumi');",
    "enhancePrompt('Research a fresh angle for a coding workflow', 'engineering', {sourceId: 'YUANBAO'}).then(result => {",
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
