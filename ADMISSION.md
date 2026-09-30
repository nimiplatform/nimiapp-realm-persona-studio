# Realm Persona Studio Nimi Listing Request

This document is a developer-submitted listing request. It is not an approval, release descriptor, permission grant, or install truth.

## Developer Runbook

```bash
pnpm install
pnpm run check
pnpm exec nimi-app build --target windows-x86_64 --production
pnpm exec nimi-app pack --target windows-x86_64 --production
```

For protected local development through the Desktop-owned supervisor:

```bash
pnpm dev
pnpm dev:electron
```

`pnpm dev:renderer` is renderer-only and cannot perform protected operations.
The active production shell is Desktop-supervised Electron.

For this workspace's current source-development environment, use the launcher
from `/Users/snwozy/nimi-realm/nimi` while keeping Studio's installed dependencies:

```bash
cd /Users/snwozy/nimi-realm/nimi
pnpm --filter @nimiplatform/app-tools exec node bin/nimi-app.mjs dev --dir /Users/snwozy/nimi-realm/nimi-apps/nimiapp-realm-persona-studio --list-registrations
pnpm --filter @nimiplatform/app-tools exec node bin/nimi-app.mjs dev --dir /Users/snwozy/nimi-realm/nimi-apps/nimiapp-realm-persona-studio --resume <current-selector>
```

Select the existing registration from the fresh list; do not save its selector.
This is an external development launcher, not a Studio SDK/Kit dependency or
an installed-App acceptance claim. It speaks the current dev Desktop's caller
authentication protocol; Studio remains on app-tools 0.7.5, SDK 0.11 and Kit 0.7.

Source-development verification on 2026-09-30 used that external launcher and
the existing Studio registration, with the installed dependency versions unchanged:

- Verified: Desktop-supervised Studio launch, protected account status, owner
  PersonaCharacter reads, and source-backed WorldCore names.
- Verified through the actual App UI: local Post draft save/reopen, unsaved
  navigation cancellation, deletion cancellation/confirmation, and local schedule
  save/reopen, foreground due notice and clearing. The test draft and schedule
  were removed after verification; no Realm profile or Post was written.
- Artifact upload passed, but artifact read failed with
  `runtime-service-untrusted`. The running App loaded the source environment's
  native bridge. Its current artifact read projection emits base64, while Kit
  0.7 validates a numeric byte array. Successful edited-image candidate
  persistence and reopening remain NOT-VERIFIED under this combination.
- Real AI generation, owner PersonaCharacter create/replace/delete, and
  installed production-App journeys remain NOT-VERIFIED. These results do not
  establish release or admission readiness. Runtime test uploads are not Studio
  history entries; the current public artifact surface exposes no delete call.

Additional window-close verification used Studio's actual navigation guard and
Host unload handler in an isolated Electron window. The native Cancel button
preserved the dirty editor state; Discard and leave closed the window. This
checks native window behavior, not Desktop supervision or protected access.

The current App Tools authoring schema still requires `cargo_package_name` and
`tauri_identifier` metadata in generated identity and submission inputs. These
fields do not select the shell or provide a Tauri runtime path.

## Submission Inputs

- `nimi.app.yaml` declares app identity and requested Nimi API scopes.
- `.nimi/admission/submission.yaml` records publish-readiness commands and review inputs.
- `.nimi/config/build-profile.yaml` selects the actual target build and payload; `.nimi/admission/build-profile.yaml` summarizes the developer workflow for review.
- `.nimi/spec/realm-persona-studio/canonical/**` is the canonical v2 product/app authority surface.
- `nimi-app pack` packages the selected production payload after a successful target build.

### Requested access purposes

- `realm.data` — purpose: read the owner's PersonaCharacter portfolio and WorldCore presentation, and create, replace or delete Personas through the admitted owner operations.
- `runtime.consume` — purpose: generate owner-reviewed text, image and voice candidates through the SDK/Kit carrier and keep local image artifacts under protected Runtime custody.

These purposes explain the existing requested domains; they do not grant access.
The manifest keeps the string-list format required by App Tools 0.7.5.

The submission's scaffold boundary review input is the candidate-only declaration
rendered by the selected App Tools package. It records a review boundary for this
existing App; it does not claim fresh scaffold creation, a scaffold intent/lock,
or platform admission.

## Reviewer Boundary

Nimi Platform review owns final admission, release descriptors, ordinary-user visibility, install availability, and permission grants. Local configuration, build results and submission archives do not constitute those grants or descriptors.

## Pre-submission self-check

Local checks are pre-submission self-checks only; passing them does not establish admission truth.

```bash
pnpm run validate      # validate the published App Tools project configuration
pnpm run check         # configuration, authority, i18n, types, lint and tests
pnpm exec nimi-app check --production
pnpm exec nimi-app build --target windows-x86_64 --production
pnpm exec nimi-app pack --target windows-x86_64 --production
```
