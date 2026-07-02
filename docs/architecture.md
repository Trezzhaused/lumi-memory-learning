# LUMI Architecture Overview

## Components

- Meta-controller: issues bounded policy decisions for training and execution
- Learner agent: performs training, replay, and architecture updates under guardrails
- Evaluator agent: scores outcomes and routes failures to review or rollback
- Safety kernel: enforces allowlists, invariant checks, and audit logging
- Federation layer: aggregates model updates without sharing raw data

## Execution Model

1. The meta-controller selects an approved objective.
2. The learner agent performs bounded updates and records provenance.
3. The evaluator scores the outcome and triggers rollback on violation.
4. The safety kernel emits immutable audit entries and blocks unsafe actions.

## Remote-owner runtime connector

A small remote-owner runtime connector sits behind the existing bridge and forwards approved owner-side actions to an optional HTTP endpoint. The connector is intentionally simple so it can later evolve into a secure Windows listener, a Tailscale-backed runtime bridge, or a private cloud execution path without changing the public chat core.

The connector is enabled when `LUMI_REMOTE_OWNER_RUNTIME_URL` is set and the action is `remote-owner-runtime`. Optional bearer auth can be supplied with `LUMI_REMOTE_OWNER_RUNTIME_TOKEN`.
