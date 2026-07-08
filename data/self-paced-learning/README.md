# Self-paced learning data

This directory stores a lightweight question bank and tier-alignment matrix for the adaptive self-paced course engine.

## Files

- `tier-alignment.json` — canonical mapping from age and tier to curricular focus.
- `questions.jsonl` — JSONL question bank with self-paced metadata and hints.

## Usage

Run `node scripts/self-paced-engine.mjs` to simulate question routing and adaptation using the generated question bank.
