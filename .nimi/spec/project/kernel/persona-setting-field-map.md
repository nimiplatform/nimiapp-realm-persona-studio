---
id: SPEC-REALM-PERSONA-STUDIO-SETTING-FIELD-MAP-001
title: Persona Setting Field Admission Map
status: active
owner: "@team"
updated: 2026-06-18
---

# Persona Setting Field Admission Map

## Admitted Core Fields

- **[R-RPS-SETTING-001]** displayName is admitted as RealmPersona.core.displayName.
- **[R-RPS-SETTING-002]** handle is admitted as RealmPersona.core.handle during create and replacement when owner-reviewed.
- **[R-RPS-SETTING-003]** description and bio normalize to owner-reviewed profile description inside RealmPersona.core.
- **[R-RPS-SETTING-004]** greeting is admitted as an owner-reviewed first-message field inside RealmPersona.core.
- **[R-RPS-SETTING-005]** identity, personality, communication, boundaries, and positioning are admitted as structured owner-reviewed core sections.
- **[R-RPS-SETTING-006]** socialVisibility is admitted as a structured core section with PUBLIC, FRIENDS, or PRIVATE values.
- **[R-RPS-SETTING-007]** avatarUrl, referenceImageUrl, and profileCoverUrl may be stored only as reviewed core fields or local candidates; a local preview is not public asset authority.
- **[R-RPS-SETTING-008]** Voice settings may be read or proposed from core, but public voice publication requires an admitted Realm write path.

## Save Path

- **[R-RPS-SETTING-009]** Every setting write builds a complete ReplaceRealmPersonaDto from the latest detail read.
- **[R-RPS-SETTING-010]** The write must include baseContentHash, homeWorldId, origin, and merged core.
- **[R-RPS-SETTING-011]** The write must not submit raw rule text, provider/model configuration, LocalAgent state, private transcript, or unreviewed generated JSON.
- **[R-RPS-SETTING-012]** Runtime setting proposals are editable candidates and must return to the same owner-reviewed save path.
- **[R-RPS-SETTING-013]** A no-change diff returns a no-op failure state, not a fake Realm write success.
- **[R-RPS-SETTING-014]** Invalid visibility values, malformed structured fields, and stale hashes fail closed before write.
