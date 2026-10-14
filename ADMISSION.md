# Realm Persona Studio Nimi Listing Request

This document is a developer-submitted listing request. It is not an approval, release descriptor, operational access grant, or install truth. Release and signing governance are documented in `README.md` and `RELEASE_NOTES.md`.

## Developer Runbook

Realm Persona Studio targets the Desktop-supervised Electron host with `@nimiplatform/sdk` (`^0.21.0`), `@nimiplatform/kit` (`^0.19.0`), `@nimiplatform/app-tools` (`^0.12.1`), and `@nimiplatform/nimi-coding` (`0.6.5`).

Install dependencies and start protected local development through the Desktop-supervised Electron host (`pnpm dev` runs `nimi-app dev --shell electron`; `pnpm dev:shell` runs `nimi-app dev`):

```bash
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm dev:renderer` starts only the unprivileged renderer and cannot perform protected operations.

Because `pnpm dev` is a blocking process, open a separate terminal to run project checks, target builds, and packaging. Build and package commands must run on the matching host OS with an explicit target (`windows-x86_64` on Windows; replace with `macos-aarch64` on Apple Silicon macOS):

```bash
pnpm check
pnpm exec nimi-app check
pnpm exec nimi-app build --target windows-x86_64
pnpm exec nimi-app pack --target windows-x86_64
```

Current App Tools authoring and submission schemas may still retain `cargo_package_name` and `tauri_identifier` metadata fields. These fields do not select the runtime shell or enable a Tauri IPC path; the active host shell is Electron.

## Submission Inputs

- `nimi.app.yaml` declares `app_id`, requested `app_access` domains, and app metadata.
- `.nimi/config/build-profile.yaml` defines the target builds, payload paths, and lockfile policy.
- `.nimi/admission/submission.yaml` references `.nimi/config/build-profile.yaml` and records publish-readiness commands and review inputs.
- `.nimi/spec/**` is the product and app specification authority surface for this repository.
- The scaffold boundary declaration is a candidate review input rendered by App Tools; it records a boundary for this existing App and does not claim fresh scaffold creation, a scaffold lock, or platform admission.
- `nimi-app pack --target <target>` outputs `dist/nimi-app/*.nimiapp`, `dist/nimi-app/*.target.json`, and `dist/nimi-app/*.app-info.json` after a successful target build, while `nimi-app pack --aggregate` outputs `dist/nimi-app/*.candidate.json`.

### Requested access purposes

- `realm.data` — purpose: read the owner's PersonaCharacter portfolio and WorldCore presentation, and create, replace, or delete Personas through admitted owner operations.
- `runtime.consume` — purpose: generate owner-reviewed text, image, and voice candidates through the SDK/Kit carrier and keep local image artifacts under protected Runtime custody.

These entries explain the declared `app_access` domains in `nimi.app.yaml`; declarations themselves do not grant operational authorization.

## Governance and Reviewer Boundary

- **Runtime** owns app registration, active session admission, operation access enforcement, and Nimi credential custody.
- **Desktop** provides exact Host supervision, process lifecycle management, and user management entrypoints.
- **Registry / Platform review** governs catalog review, ordinary-user listing visibility, and approved release descriptors (while any separate Integration standing resource permissions remain governed by their own resource model).

Local configuration, build results, and packaged files under `dist/nimi-app/` do not constitute active session admission, operational authorization, or an approved release descriptor. See `README.md` and `RELEASE_NOTES.md` for release and signing details.

## Pre-submission Self-Check

Local checks are pre-submission self-checks only; passing them does not establish admission truth. Run them in a separate terminal from `pnpm dev` (replace `windows-x86_64` with `macos-aarch64` on macOS):

```bash
pnpm check
pnpm exec nimi-app check --production
pnpm exec nimi-app build --target windows-x86_64 --production
pnpm exec nimi-app pack --target windows-x86_64 --production
```

## Historical Verification Record (2026-09-30)

The following verification was recorded on `2026-09-30` using an external development launcher against an existing Studio registration while the repository was on `@nimiplatform/app-tools` `0.7.5`, `@nimiplatform/sdk` `0.11`, and `@nimiplatform/kit` `0.7`. Upgrading dependencies to the current toolchain does not constitute re-verification of the `NOT-VERIFIED` items below:

- **Verified (2026-09-30):** Desktop-supervised Studio launch, protected account status, owner PersonaCharacter reads, and source-backed WorldCore names.
- **Verified via App UI (2026-09-30):** Local Post draft save/reopen, unsaved navigation cancellation, deletion cancellation/confirmation, and local schedule save/reopen, foreground due notice, and clearing. The test draft and schedule were removed after verification; no Realm profile or Post was written.
- **Artifact read mismatch (`NOT-VERIFIED`):** On `2026-09-30`, artifact upload passed, but artifact read failed with `runtime-service-untrusted` because the native bridge artifact read projection emitted base64 while Kit `0.7` validated a numeric byte array. Successful edited-image candidate persistence and reopening remain `NOT-VERIFIED` until re-tested.
- **Remaining journeys (`NOT-VERIFIED`):** Real AI generation, owner PersonaCharacter create/replace/delete, and installed production-App journeys remain `NOT-VERIFIED`. Runtime test uploads are not Studio history entries, and the public artifact surface exposed no delete call.
- **Additional isolated window-close check:** Additional window-close verification used Studio's navigation guard and Host unload handler in an isolated Electron window. The native Cancel button preserved the dirty editor state, and Discard and leave closed the window. This verified native window behavior only, not Desktop supervision or protected access.
