import assert from "node:assert/strict";
import {test} from "node:test";
import {buildTrainingResourceAnalysis} from "../lumi-training-resources";
import {forget, ingestKnowledgeEntries, recordRetrievalFeedback, remember, quarantineMemoryEntry, reviewMemoryEntry, search} from "../lumi-memory";

test("quarantine, review, and feedback update memory state", {concurrency: false}, async () => {
    const sessionId = `memory-test-${Date.now()}`;
    const entry = await remember(sessionId, "assistant", "Alpha beta gamma for adaptive learning", ["test"], "knowledge");

    const quarantined = await quarantineMemoryEntry(entry.id, "needs review");
    assert.equal(quarantined?.reviewStatus, "quarantined");
    assert.equal(quarantined?.quarantineReason, "needs review");

    const reviewed = await reviewMemoryEntry(entry.id, "approved", "operator", "high", 0.95);
    assert.equal(reviewed?.reviewStatus, "approved");
    assert.equal(reviewed?.reviewedBy, "operator");
    assert.equal(reviewed?.qualityScore, 0.95);

    const feedback = await recordRetrievalFeedback("alpha beta", [entry.id], "useful", "high");
    assert.equal(feedback.outcome, "useful");
    assert.equal(feedback.entryIds[0], entry.id);

    const results = await search("alpha beta", 5, {includeQuarantined: true});
    assert.ok(results.some(result => result.id === entry.id));

    await forget(sessionId);
});

test("knowledge ingestion creates reviewable entries", {concurrency: false}, async () => {
    const entries = await ingestKnowledgeEntries("test-source", "Seed item content for calibration and review", {
        sessionId: `ingest-test-${Date.now()}`,
        tags: ["test"],
        reviewStatus: "pending",
        confidence: "medium",
        qualityScore: 0.62,
    });

    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.type, "knowledge");
    assert.equal(entries[0]?.reviewStatus, "pending");
    assert.equal(entries[0]?.tags.includes("test"), true);

    await forget(entries[0]!.sessionId);
});

test("training resource catalog includes the requested education and agent resources", () => {
    const analysis = buildTrainingResourceAnalysis();
    const resourceIds = new Set(analysis.resources.map(resource => resource.id));
    const requiredResourceIds = [
        "a-to-z-students",
        "awesome-claude-code-subagents",
        "awesome-agent-skills",
        "awesome-deep-learning",
        "awesome-stock-resources",
        "awesome-math",
        "awesome-generative-ai",
        "awesome-nano-banana-pro-prompts",
        "mind-expanding-books",
        "awesome-chatgpt-api",
        "awesome-free-apps",
        "awesome-cryptography",
        "awesome-blender",
        "awesome-crawler",
        "awesome-gpt-image-2",
        "alternative-front-ends",
        "ai-collection",
        "awesome-totally-open-chatgpt",
        "awesome-db-tools",
        "awesome-ai-tools",
        "awesome-infosec",
        "awesome-video-diffusion",
        "awesome-ai-in-finance",
        "humhub",
    ];

    for (const id of requiredResourceIds) {
        assert.equal(resourceIds.has(id), true, `expected resource ${id} to be present`);
    }

    assert.ok(analysis.knowledgeBankSummary.includes("sub-agent"));
    assert.ok(analysis.knowledgeBankSummary.includes("stock-image"));
});
