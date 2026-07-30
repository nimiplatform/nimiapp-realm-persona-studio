---
id: SPEC-REALM-PERSONA-STUDIO-STORYBOOK-001
title: Realm Persona Studio Storybook
status: active
owner: "@team"
updated: 2026-07-09
---

# Storybook

| Story | Rule |
|---|---|
| Review persona portfolio | **[R-RPS-STORY-001]** Owner personas load from listRealmPersonas; unavailable metrics stay unavailable. |
| Inspect persona detail | **[R-RPS-STORY-002]** Detail loads from getRealmPersona before edit workspaces enable source-backed actions. |
| Create persona | **[R-RPS-STORY-003]** Owner draft normalizes into CreateRealmPersonaDto, defaults world from WorldCore, and succeeds only after Realm returns canonical id. |
| Update settings | **[R-RPS-STORY-004]** Owner-reviewed settings merge into RealmPersona.core and save through replaceRealmPersona with baseContentHash. |
| Review consistency | **[R-RPS-STORY-005]** Runtime review is advisory and returns to owner-reviewed settings save. |
| Generate identity assets | **[R-RPS-STORY-006]** Visual and voice outputs are local candidates until a reviewed Realm core write succeeds. |
| Draft post | **[R-RPS-STORY-007]** Post copy assistance uses visible persona context and remains local until Realm post creation succeeds. |
| Schedule locally | **[R-RPS-STORY-008]** The local schedule is one foreground desktop operation per persona, not public schedule state. |
| Prepare localAgent context | **[R-RPS-STORY-009]** localAgent chat readiness uses SourceMaterializationPacket by value and never exposes private LocalAgent memory. |
| Keep adjacent products out | **[R-RPS-STORY-010]** WorldCharacter maintenance, Forge curation, CharacterCard import, and legacy Realm-side Agent routes stay out of Studio routes. |
