# K-College Upgrade

This document preserves the next-stage assessment-platform enhancements for later implementation after the current self-paced adaptive engine is stabilized.

## Recommended benefits to add next

The highest-value additions for this repository are:

1. Sympson-Hetter exposure control
   - Prevents over-exposure of high-information items and improves test security.
2. Background worker / scheduled audit pipeline
   - Moves expensive or periodic quality checks off the main request path.
3. Database-backed quarantine workflow
   - Lets the system disable defective items safely and persist the change.
4. Online calibration for seed items
   - Allows new questions to be introduced cautiously before their parameters are fully calibrated.
5. Prometheus / Grafana telemetry integration
   - Improves observability for routing behavior, stability, and quarantine counts.
6. MIRT (multi-skill) modeling
   - Extends the current single-skill 3PL approach to richer multi-skill assessment.

## Why these are the best next benefits

These additions fit the current repository architecture well because they build directly on the existing adaptive-learning foundation in `lumi-self-paced.ts`, the self-paced API routes in `app.ts`, and the generated question-bank assets in `data/self-paced-learning/`.

They also provide a strong progression:

- Start with operational safeguards and monitoring.
- Then add safer onboarding for new items.
- Only later expand into richer psychometric models such as MIRT.

## Deferred implementation package

The following items are intentionally preserved here as a future implementation package rather than being added immediately to the core runtime:

- Sympson-Hetter exposure control
- Background worker / scheduled audit pipeline
- Database-backed quarantine workflow
- Online calibration for seed items
- Prometheus / Grafana telemetry integration
- MIRT (multi-skill) modeling

## Suggested rollout

- Phase 1: Exposure control plus audit/quarantine hooks
- Phase 2: Seed-item calibration plus lightweight telemetry
- Phase 3: MIRT and broader monitoring infrastructure
