---
id: SPEC-REALM-PERSONA-STUDIO-FAILURE-SEMANTICS-001
title: Failure Semantics
status: active
owner: "@team"
updated: 2026-07-09
---

# Failure Semantics

- **[R-RPS-FAIL-001]** Realm unavailable.
- **[R-RPS-FAIL-002]** Permission missing.
- **[R-RPS-FAIL-003]** Owner authority missing.
- **[R-RPS-FAIL-004]** Portfolio source unavailable.
- **[R-RPS-FAIL-005]** Persona detail source unavailable.
- **[R-RPS-FAIL-006]** Persona creation rejected.
- **[R-RPS-FAIL-007]** Persona creation returned no canonical id.
- **[R-RPS-FAIL-008]** Base content hash missing or stale.
- **[R-RPS-FAIL-009]** WorldCore selection unavailable.
- **[R-RPS-FAIL-010]** Setting payload invalid.
- **[R-RPS-FAIL-011]** Setting replacement returned no canonical updated object.
- **[R-RPS-FAIL-012]** Runtime transport unavailable.
- **[R-RPS-FAIL-013]** Runtime route unbound.
- **[R-RPS-FAIL-014]** Runtime output malformed.
- **[R-RPS-FAIL-015]** Local candidate history unavailable.
- **[R-RPS-FAIL-016]** Post publish failed.
- **[R-RPS-FAIL-017]** Local schedule cannot be persisted.
- **[R-RPS-FAIL-018]** No failure may be converted into placeholder success, fake return data, synthesized metric, or renderer-local source authority.
- **[R-RPS-FAIL-019]** Missing Desktop shared Runtime account state, missing installed app launch binding, or unavailable standard shell capability is an explicit capability-unavailable failure and must not redirect to an app-owned login, OAuth, Runtime defaults bootstrap, or token/session fallback.
