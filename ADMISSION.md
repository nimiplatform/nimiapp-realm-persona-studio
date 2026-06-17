# Realm Persona Studio Nimi Listing Request

This document is a developer-submitted listing request. It is not an approval, release descriptor, permission grant, or install truth.

## Developer Runbook

```bash
pnpm install
pnpm run check
pnpm run pack
```

For local Tauri development:

```bash
pnpm dev:shell       # full Tauri shell (renderer + native window)
pnpm dev:renderer    # renderer only (vite dev server on http://127.0.0.1:1450)
```

## Submission Inputs

- `nimi.app.yaml` declares app identity and requested Nimi API scopes.
- `.nimi/admission/submission.yaml` records publish-readiness commands and review inputs.
- `.nimi/admission/build-profile.yaml` records install, build, and lockfile policy.
- `.nimi/spec/project/kernel/**` is the canonical product/app authority surface (kernel-style, with the enumerated `R-RPS-<DOMAIN>-NNN` rule catalog at `tables/rule-catalog.yaml`).
- `dist/nimi-app-submission.json` is produced by `pnpm run pack` after a successful renderer build.

## Reviewer Boundary

Nimi Platform review owns final admission, release descriptors, ordinary-user visibility, install availability, and permission grants. Nothing in this repository or in `dist/nimi-app-submission.json` constitutes an install grant, a permission grant, or a public release descriptor.

## Pre-submission self-check

Local checks are pre-submission self-checks only; passing them does not establish admission truth.

```bash
pnpm run validate       # check manifest/submission/build-profile role markers
pnpm run local-audit    # check admission inputs do not claim platform-owned truth
pnpm run pack           # produce dist/nimi-app-submission.json (requires renderer build)
pnpm run check          # validate + local-audit + spec-consistency + typecheck + lint + test
```
