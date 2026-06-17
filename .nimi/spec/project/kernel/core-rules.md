---
id: SPEC-REALM-PERSONA-STUDIO-CORE-RULES-001
title: Realm Persona Studio Core Rules
status: active
owner: "@team"
updated: 2026-06-18
---

# Core Rules

- **[R-RPS-CORE-001]** .nimi/spec/project/kernel/** is the single current app authority for Realm Persona Studio.
- **[R-RPS-CORE-002]** Current app authority is based on WorldCore / RealmPersona / RuntimeSourceSnapshot; Realm-side Agent, CharacterCard, rule package, truth package, and projection package paths are non-current.
- **[R-RPS-CORE-003]** The word Agent may appear in this app only as LocalAgent runtime terminology or in explicitly forbidden legacy surface names.
- **[R-RPS-CORE-004]** Every public success claim must be backed by a typed Realm, Runtime, SDK, or Tauri result; renderer-local state cannot satisfy source authority.
- **[R-RPS-CORE-005]** No app-local cache, draft, generated candidate, screenshot, test fixture, or local audit output may become product authority.
- **[R-RPS-CORE-006]** Missing source fields render as unavailable, not as zero, empty invented values, or optimistic defaults.
- **[R-RPS-CORE-007]** Writes must fail closed when baseContentHash, homeWorldId, origin, required core fields, or Realm response identity are missing.
- **[R-RPS-CORE-008]** Runtime output is candidate material until an owner-reviewed Realm core write succeeds.
- **[R-RPS-CORE-009]** Studio must not implement dual-track compatibility with previous RealmAgent, CharacterCard, or rule/truth/projection package flows.
- **[R-RPS-CORE-010]** Tests for source reads, writes, Runtime candidates, and failure states must assert canonical current surfaces by name.
- **[R-RPS-CORE-011]** Any new external surface must be admitted by this kernel before code can consume it as a success path.
- **[R-RPS-CORE-012]** Spec changes and implementation changes for the same behavior must land together; a stale spec path is treated as an active defect.
