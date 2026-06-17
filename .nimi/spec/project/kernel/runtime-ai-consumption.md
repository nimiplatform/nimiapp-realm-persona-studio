---
id: SPEC-REALM-PERSONA-STUDIO-RUNTIME-AI-001
title: Runtime AI Consumption
status: active
owner: "@team"
updated: 2026-06-18
---

# Runtime AI Consumption

- **[R-RPS-RUNTIME-001]** Runtime text, image, and speech calls are candidate-generation surfaces, not Realm authority.
- **[R-RPS-RUNTIME-002]** RuntimeSourceSnapshot creation uses sourceRef.kind = realmPersona, worldId, sourceId, and sourceContentHash.
- **[R-RPS-RUNTIME-003]** RuntimeSourceSnapshot payloads are by-value materializations and must not write back to RealmPersona.
- **[R-RPS-RUNTIME-004]** localAgent chat readiness may be generated only from RuntimeSourceSnapshot and owner-visible fields.
- **[R-RPS-RUNTIME-005]** Studio must never send private LocalAgent memory, emotions, cognition, private transcript, or app-specific memory fragments to these workflows.
- **[R-RPS-RUNTIME-006]** Runtime proposals must exclude provider, model, lifecycle, owner override, hidden world override, raw rules, and canonical id creation.
- **[R-RPS-RUNTIME-007]** Runtime route-unbound, transport-unavailable, malformed-output, and invalid-payload states are explicit failures.
- **[R-RPS-RUNTIME-008]** Runtime output accepted by the owner still requires the admitted Realm core replacement before it becomes source state.
