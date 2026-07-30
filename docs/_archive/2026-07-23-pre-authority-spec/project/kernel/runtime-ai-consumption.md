---
id: SPEC-REALM-PERSONA-STUDIO-RUNTIME-AI-001
title: Runtime AI Consumption
status: active
owner: "@team"
updated: 2026-07-11
---

# Runtime AI Consumption

- **[R-RPS-RUNTIME-001]** Runtime text, image, and speech calls are candidate-generation surfaces, not Realm authority.
- **[R-RPS-RUNTIME-002]** SourceMaterializationPacket creation uses sourceRef.kind = realmPersona, worldId, sourceId, and sourceContentHash.
- **[R-RPS-RUNTIME-003]** SourceMaterializationPacket payloads are by-value materializations and must not write back to RealmPersona.
- **[R-RPS-RUNTIME-004]** localAgent chat readiness may be generated only from SourceMaterializationPacket and owner-visible fields.
- **[R-RPS-RUNTIME-005]** Studio must never send private LocalAgent memory, emotions, cognition, private transcript, or app-specific memory fragments to these workflows.
- **[R-RPS-RUNTIME-006]** Runtime proposals must exclude provider, model, lifecycle, owner override, hidden world override, raw rules, and canonical id creation.
- **[R-RPS-RUNTIME-007]** Runtime route-unbound, transport-unavailable, malformed-output, and invalid-payload states are explicit failures.
- **[R-RPS-RUNTIME-008]** Runtime output accepted by the owner still requires the admitted Realm core replacement before it becomes source state.
- **[R-RPS-RUNTIME-009]** Runtime account state is host-owned Desktop shared auth; Studio must not log in, open OAuth, exchange tokens, store sessions, refresh tokens, or access tokens.
- **[R-RPS-RUNTIME-010]** Realm and Runtime calls require a separately admitted SDK/Kit protected installed operation. Studio must not implement custom Realm unary transport, generic Runtime bridge access, auth envelopes, caller metadata, Runtime app registration, renderer launch binding, or Runtime defaults bootstrap.
- **[R-RPS-RUNTIME-011]** AI provider/model configuration may use standard-shell `ai-config.get` / `ai-config.set` only after those operations are admitted for the installed capability set. Until then they fail closed; Studio may preserve persona prompts, preferences, drafts, candidates, and review state, but must not create app-local provider token custody, model registry truth, configuration fallback, or model availability simulation.
