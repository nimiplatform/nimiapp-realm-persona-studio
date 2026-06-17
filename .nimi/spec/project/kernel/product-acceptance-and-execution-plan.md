---
id: SPEC-REALM-PERSONA-STUDIO-PRODUCT-ACCEPTANCE-001
title: Product Acceptance And Execution Plan
status: active
owner: "@team"
updated: 2026-06-18
---

# Product Acceptance And Execution Plan

## Acceptance Gates

- **[R-RPS-ACCEPT-001]** App identity is Realm Persona Studio across package metadata, Tauri identity, routes, README, and spec.
- **[R-RPS-ACCEPT-002]** Source reads use WorldCoreController RealmPersona surfaces only.
- **[R-RPS-ACCEPT-003]** Create/update writes use Realm core DTOs only.
- **[R-RPS-ACCEPT-004]** RuntimeSourceSnapshot is the only Realm-to-runtime materialization path in this app.
- **[R-RPS-ACCEPT-005]** Non-runtime Agent naming is absent from source code and current app authority, except legacy-denylist strings.
- **[R-RPS-ACCEPT-006]** CharacterCard import and RealmAgent compatibility are absent from current success paths.
- **[R-RPS-ACCEPT-007]** Persona settings, assets, posts, and Runtime review all preserve candidate-vs-source boundaries.
- **[R-RPS-ACCEPT-008]** Failure states are explicit and fail closed.
- **[R-RPS-ACCEPT-009]** pnpm run check:spec-consistency, typecheck, test, validate, local-audit, build, and check must pass before acceptance.
- **[R-RPS-ACCEPT-010]** Any remaining occurrence of old terminology must be either LocalAgent runtime wording or an explicit forbidden legacy surface in a guard.

## Execution Order

- **[R-RPS-ACCEPT-011]** Recut spec authority before accepting implementation changes.
- **[R-RPS-ACCEPT-012]** Recut source identifiers and user-visible copy before release packaging.
- **[R-RPS-ACCEPT-013]** Re-run Studio checks after every generated client or SDK change.
- **[R-RPS-ACCEPT-014]** Do not start downstream compatibility work by restoring old routes; downstream must adapt to the hard-cut core interfaces.
