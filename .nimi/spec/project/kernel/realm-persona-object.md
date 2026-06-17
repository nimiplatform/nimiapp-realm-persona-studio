---
id: SPEC-REALM-PERSONA-STUDIO-REALM-PERSONA-OBJECT-001
title: Realm Persona Object
status: active
owner: "@team"
updated: 2026-06-18
---

# Realm Persona Object

## Object Authority

- **[R-RPS-PERSONA-001]** A Studio persona exists only after Realm returns a canonical RealmPersonaDto.id.
- **[R-RPS-PERSONA-002]** The canonical detail object is RealmPersonaDto from WorldCoreController.getRealmPersona.
- **[R-RPS-PERSONA-003]** The canonical list object is RealmPersonaDto[] from WorldCoreController.listRealmPersonas.
- **[R-RPS-PERSONA-004]** id, homeWorldId, origin, contentHash, contentRevision, state, and core must be preserved from Realm responses without local reinterpretation.
- **[R-RPS-PERSONA-005]** Display name, handle, description, greeting, profile media, voice settings, visibility settings, and positioning are source fields inside RealmPersona.core when present.
- **[R-RPS-PERSONA-006]** Missing optional fields must render as unavailable or empty source-backed fields; Studio must not synthesize persona identity.
- **[R-RPS-PERSONA-007]** Owner scope is proven by the admitted Realm core surface returning the object for the current account session.
- **[R-RPS-PERSONA-008]** WorldCharacterCore objects are not owner personas and must not appear in the owner portfolio.

## Write Authority

- **[R-RPS-PERSONA-009]** Persona creation calls WorldCoreController.createRealmPersona with homeWorldId, origin, and reviewed core.
- **[R-RPS-PERSONA-010]** Persona replacement calls WorldCoreController.replaceRealmPersona with the latest baseContentHash.
- **[R-RPS-PERSONA-011]** A replace success is valid only when Realm returns the updated RealmPersonaDto with a new or confirmed contentHash.
- **[R-RPS-PERSONA-012]** Studio must re-read or refresh canonical detail after writes before presenting updated source-backed state.
- **[R-RPS-PERSONA-013]** Local drafts, Runtime proposals, and media candidates never become the canonical persona object by themselves.
