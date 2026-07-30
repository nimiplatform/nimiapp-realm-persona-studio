---
id: SPEC-REALM-PERSONA-STUDIO-PERSONA-CREATION-GRAPH-001
title: Persona Creation Graph
status: active
owner: "@team"
updated: 2026-06-18
---

# Persona Creation Graph

- **[R-RPS-GRAPH-001]** The creation graph is a local owner-reviewed candidate workspace, not Realm authority.
- **[R-RPS-GRAPH-002]** Graph inputs may include owner text, selected world, reference image URL, and current owner-approved persona fields.
- **[R-RPS-GRAPH-003]** CharacterCard files, RealmAgent exports, raw rule packages, and provider hidden state are not graph inputs.
- **[R-RPS-GRAPH-004]** Every graph-derived create payload must normalize to CreateRealmPersonaDto shape: homeWorldId, origin, and core.
- **[R-RPS-GRAPH-005]** OASIS defaulting must resolve from Realm WorldCore data before submit.
- **[R-RPS-GRAPH-006]** Handle uniqueness preflight may compare current owner portfolio data, but create success still requires Realm create confirmation.
- **[R-RPS-GRAPH-007]** Runtime draft generation can propose text fields only; it must not output IDs, content hashes, provider routing, LocalAgent state, or hidden lifecycle fields.
- **[R-RPS-GRAPH-008]** Generated reference image prompts and voice prompts remain local candidates until owner review.
- **[R-RPS-GRAPH-009]** Existing persona remix may use only owner-visible source fields and must not copy private runtime state.
- **[R-RPS-GRAPH-010]** After Realm create succeeds, Studio routes to the created persona detail workspace and refreshes source state.
