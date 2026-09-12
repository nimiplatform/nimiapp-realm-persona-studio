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
The current App Tools authoring schema still requires `cargo_package_name` and
`tauri_identifier` metadata in generated identity and submission inputs. These
fields do not select the shell or provide a Tauri runtime path.

## Submission Inputs

- `nimi.app.yaml` declares app identity and requested Nimi API scopes.
- `.nimi/admission/submission.yaml` records publish-readiness commands and review inputs.
- `.nimi/config/build-profile.yaml` selects the actual target build and payload; `.nimi/admission/build-profile.yaml` summarizes the developer workflow for review.
- `.nimi/spec/realm-persona-studio/canonical/**` is the canonical v2 product/app authority surface.
- `nimi-app pack` packages the selected production payload after a successful target build.

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
