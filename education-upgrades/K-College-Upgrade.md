# K-College Upgrade Plan

This document is the staged handoff plan for the larger educational-runtime upgrade that should happen after the lightweight adaptive-learning loop is fully hardened.

## Goals
- Preserve the current adaptive-learning memory, quarantine, calibration, and observability work in this repository.
- Introduce a dedicated K-College runtime for curriculum planning, assessment, and guided learning journeys.
- Keep the implementation modular so it can be adopted incrementally when the team is ready.

## Proposed implementation phases
1. Foundation
   - Stand up a dedicated FastAPI service for plans, assessments, and pathway orchestration.
   - Keep the existing Lumi REST surface intact and map new K-College routes onto it.
2. Learning engine
   - Add Celery-backed task orchestration for plan generation, assessment scoring, and resource ingestion.
   - Persist learner progress, competency history, and recommendation state.
3. Personalization and analytics
   - Introduce MIRT-style adaptive sequencing and mastery tracking.
   - Connect feedback loops to the existing memory calibration and observability endpoints.
4. Deployment readiness
   - Add production-safe configuration, monitoring, and rollout controls.
   - Document migration steps and owner review requirements.

## Repository fit
- Existing lightweight hooks: `/api/lumi/kcollege/plan`, `/api/lumi/kcollege/assessment`, `/api/lumi/kcollege/resources/ingest`
- Existing memory-adaptation surface: quarantine/review/feedback, observability evaluation, and retrieval calibration
- Deferred work: the broader Python/FastAPI/Celery/MIRT stack should live here and remain separate from the current lightweight operational loop

## Ready-to-implement checklist
- [x] Preserve current Lumi adaptive-learning work as the baseline
- [x] Capture the future K-College runtime architecture in this document
- [x] Leave a clean transition point for implementation when the team is ready
