---
id: SPEC-REALM-PERSONA-STUDIO-PRODUCT-SCOPE-001
title: Realm Persona Studio Product Scope
status: active
owner: "@team"
updated: 2026-06-18
---

# Product Scope

## In Scope

- **[R-RPS-SCOPE-001]** The app manages current-user owned RealmPersona source objects.
- **[R-RPS-SCOPE-002]** Portfolio list, detail, create, settings, visibility, identity assets, post drafting, Runtime-assisted review, and local schedule workspaces are in scope only when they remain source-backed or candidate-only.
- **[R-RPS-SCOPE-003]** Home-world selection is read from Realm WorldCore data and submitted into RealmPersona.homeWorldId.
- **[R-RPS-SCOPE-004]** Owner settings are stored as reviewed RealmPersona.core replacements, not as hidden app state.
- **[R-RPS-SCOPE-005]** Local creative history and local schedules are desktop-local operation aids and must not claim Realm public state.

## Out Of Scope

- **[R-RPS-SCOPE-006]** Realm World Studio world-character maintenance is out of scope.
- **[R-RPS-SCOPE-007]** Forge-imported system curation and preset world authoring are out of scope.
- **[R-RPS-SCOPE-008]** LocalAgent private memory, emotion, cognition, transcript, and autonomous runtime state are out of scope.
- **[R-RPS-SCOPE-009]** Direct raw rule editing, CharacterCard import, and rule/truth/projection package publication are out of scope.
- **[R-RPS-SCOPE-010]** Version history, rollback, economic settlement, team collaboration, recurring campaign automation, and public scheduling authority are out of scope until admitted by a future kernel change.
- **[R-RPS-SCOPE-011]** Creator/world-maintainer routes cannot be used as fallback for owner persona reads or writes.
- **[R-RPS-SCOPE-012]** Public profile or account data cannot be used to prove owner write authority for a persona.
