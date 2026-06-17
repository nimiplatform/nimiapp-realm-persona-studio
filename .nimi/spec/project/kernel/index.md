---
id: SPEC-REALM-PERSONA-STUDIO-KERNEL-INDEX-001
title: Realm Persona Studio Kernel Authority
status: active
owner: "@team"
updated: 2026-06-18
---

# Realm Persona Studio Kernel Authority

## Scope

This kernel is the single authoritative product/app contract source for Realm Persona Studio. Every current rule uses R-RPS-<DOMAIN>-NNN. Topic notes, screenshots, local audit output, and generated UI state are evidence only after they are absorbed here.

Realm Persona Studio operates user-owned RealmPersona source objects. The current product data plane is WorldCore / RealmPersona / RuntimeSourceSnapshot through Realm core surfaces. It does not define a Realm-side Agent product domain, does not revive CharacterCard import, and does not route through rule/truth/projection package success paths.

## Rule ID Format

R-RPS-<DOMAIN>-NNN

| Domain | Kernel Document |
|---|---|
| CORE | core-rules.md |
| SCOPE | product-scope.md |
| PERSONA | realm-persona-object.md |
| GRAPH | persona-creation-graph.md |
| SETTING | persona-setting-field-map.md |
| ASSET | asset-and-binding.md |
| POST | post-publishing.md |
| RUNTIME | runtime-ai-consumption.md |
| METRIC | metrics-and-realm-gaps.md |
| FAIL | failure-semantics.md |
| STORY | storybook.md |
| ACCEPT | product-acceptance-and-execution-plan.md |

The catalog enumerating every current rule ID lives in tables/rule-catalog.yaml.

## Canonical Current Surfaces

- Realm WorldCoreController.listRealmPersonas is the owner portfolio list surface.
- Realm WorldCoreController.getRealmPersona is the owner persona detail surface.
- Realm WorldCoreController.createRealmPersona is the owner persona creation surface.
- Realm WorldCoreController.replaceRealmPersona is the owner-reviewed persona replacement surface. Writes must carry baseContentHash.
- Realm WorldCoreController.listWorldCores and getWorldCore are the selectable home-world surfaces.
- Realm WorldCoreController.createRuntimeSourceSnapshot materializes runtime input by value through sourceRef and never mutates RealmPersona.
- Runtime text, image, speech, and review calls are candidate generators only until an owner-reviewed Realm write succeeds.

## Explicit Non-Current Surfaces

- /api/agent/**, /api/me/agents/**, /api/creator/agents/**, world-scoped rule CRUD, Forge-imported curation, and CharacterCard import are not current success paths for this Studio.
- LocalAgent may be named only when describing runtime-private state or localAgent runtime materialization. It is not a Realm source object and is never managed by this Studio.
- Realm World Studio owns world-created WorldCharacterCore maintenance. Realm Persona Studio does not edit creator-world characters.

## Verification

- pnpm run check:spec-consistency
- pnpm run typecheck
- pnpm run test
- pnpm run validate
- pnpm run local-audit
- pnpm run build
- pnpm run check
