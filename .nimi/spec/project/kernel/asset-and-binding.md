---
id: SPEC-REALM-PERSONA-STUDIO-ASSET-BINDING-001
title: Persona Asset And Binding Boundary
status: active
owner: "@team"
updated: 2026-07-09
---

# Persona Asset And Binding Boundary

- **[R-RPS-ASSET-001]** Image, avatar, profile cover, and voice workspaces produce local candidates unless a Realm core replacement succeeds.
- **[R-RPS-ASSET-002]** Local creative history is desktop-local evidence and cannot claim public profile state.
- **[R-RPS-ASSET-003]** Runtime image and speech generation outputs are candidates and require owner review.
- **[R-RPS-ASSET-004]** A reviewed avatar URL may enter RealmPersona.core.avatarUrl only through replaceRealmPersona.
- **[R-RPS-ASSET-005]** Resource/Binding publication is not admitted for this app unless a future owner-scoped Realm ingress is added.
- **[R-RPS-ASSET-006]** The app must not write AGENT host bindings, AGENT_* binding points, or Resource-to-Agent presentation records.
- **[R-RPS-ASSET-007]** Asset candidates must preserve source persona id, source content hash, owner review state, and local timestamp.
- **[R-RPS-ASSET-008]** Missing media source data renders as unavailable and must not be replaced with stock placeholders.
- **[R-RPS-ASSET-009]** Local asset URL resolution, app data paths, and local JSON persistence must use the installed app standard shell local-assets, data, storage, or config capabilities; Studio must not expose raw Node filesystem or raw Electron IPC to the renderer.
