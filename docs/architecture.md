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
