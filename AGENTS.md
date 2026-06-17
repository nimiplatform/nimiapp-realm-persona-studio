# Realm Persona Studio AGENTS.md

> Authoritative module-level instructions for AI agents working on Realm Persona Studio.

## Identity

- **App name (English)**: Realm Persona Studio
- **Canonical Nimi app_id**: `nimi.realm-persona-studio`
- **Tauri identifier**: `nimi.realm-persona-studio`
- **One-line**: Owner-facing creation and operation desktop app for user-owned public Realm Personas.
- **Status**: Pre-Alpha, not yet launched.

## Architecture

| Layer | Technology | Location |
|-------|-----------|----------|
| Desktop shell | Tauri 2 | `src-tauri/` |
| Renderer | React 19 + Vite 7 + Tailwind 4 | `src/shell/renderer/` |
| Routing | react-router-dom 7 | `src/shell/renderer/app-shell/routes.tsx` |
| Auth & runtime bridge | local `nimi-shell-tauri` crate | `src-tauri/src/main.rs` |
| UI components | `@nimiplatform/kit` (npm) | renderer-wide |
| Platform client | `@nimiplatform/sdk` (npm) | `app-shell/studio-platform.ts` |
| State | Zustand | `app-shell/app-store.ts` |
| Dev port | 1450 | `vite.config.ts` |

## Spec Authority & Sync

`.nimi/spec/project/kernel/**` is Realm Persona Studio's canonical product/app
authority. Active authority documents are the kernel doc set declared by
`.nimi/spec/project/kernel/index.md`, and every rule carries an explicit
`R-RPS-<DOMAIN>-NNN` identifier. The full enumerated rule registry is
`.nimi/spec/project/kernel/tables/rule-catalog.yaml`. Editing rules live in
`.nimi/spec/project/AGENTS.md`; do not create parallel authority roots
(`apps/realm-persona-studio/spec/**`, repo-root `spec/**`, sibling
`.nimi/spec/<other>/**`).

`.nimi/{config,contracts,methodology}/**` are package-canonical projections
from `@nimiplatform/nimi-coding`; refresh with `pnpm exec nimicoding start
--yes` after bumping the package.

Studio canonical owner portfolio surfaces are
`Realm WorldCoreController.listRealmPersonas` and
`Realm WorldCoreController.getRealmPersona`. Create and update use
`createRealmPersona` and `replaceRealmPersona`; home-world reads use
`listWorldCores` / `getWorldCore`; runtime materialization uses
`createRuntimeSourceSnapshot`. `/portfolio` must not call Forge-imported system,
creator, world-maintainer, or dev surfaces. `/api/creator/agents`,
`/api/agent/dev/my-agents`, and `/api/agent/forge-imported-system/**` are
explicitly non-current legacy anti-targets.

The first-version owner-visible metric field is top-level `friendCount`.
Do not invent `agentFriendCount`. Do not zero-fill if the source is
unavailable — render an explicit "source unavailable" state.

## Hard Boundaries

### Scope boundary
- **In scope:** owner-created Realm Personas, public profile/settings, visual identity candidates, persona-authored posts, single local schedule, source-backed `friendCount`.
- **Out of scope:** LocalAgent private runtime / memory / emotion state, creator-world character management, Forge-imported system curation, direct persona chat from Studio, version history / rollback diffs, performance analytics, gift/economic settlement, team collaboration.

### Failure mode
- Fail-closed on every typed contract or source-availability gap. No pseudo-success, no synthesized placeholders, no zero-fill metrics, no parallel app-local shadow truth.
- Realm publish success only after `PostsService.createPost` returns a canonical post object.
- AI generation output is candidate material until owner human review.
- Local schedule store is single-candidate, foreground-only, app-local (not Realm campaign/queue).

### Auth boundary
- Studio does **not** own access or refresh tokens (mirrors parentos PO-SHELL-008 / K-ACCSVC-008).
- All Runtime account state flows through `runtime.account.*` via the `nimi-shell-tauri` IPC bridge.
- Login uses the kit's `DesktopShellAuthPage` with a code-only proof envelope; refresh-token custody lives in Runtime.

## Development Principles

### No legacy, no shims
- This project starts standalone. There is no prior deployed version, no migration burden.
- No compatibility layers, adapters, or shims.
- No "simple version first, fix later" shortcuts.
- No backward-compatible fallback logic.
- Full storybook scope from day one.

### Fail-close
- Missing platform client → fail-close, show capability unavailable in product copy.
- Realm API failure → show typed failure category (`realm-unavailable`, `permission-missing`, etc.), not silent retry.
- AI generation failure → preserve owner draft, never invent placeholder text.
- Schedule due time arrives but post draft missing → fail, do not publish stale draft.

## Admission Inputs

`nimi.app.yaml`, `ADMISSION.md`, `SECURITY.md`, and `.nimi/admission/**` are
developer-submitted review inputs, not platform admission truth. They mark
their own role:

- `nimi.app.yaml` → `manifest_role: submitted-input`
- `.nimi/admission/submission.yaml` → `submission_role: developer-submitted-input` and `admission_truth: platform-owned-after-review`
- `.nimi/admission/build-profile.yaml` → `profile_role: developer-workflow-input`

Reviewer boundary: Nimi Platform review owns final admission, release
descriptors, ordinary-user visibility, install availability, and permission
grants. Do not promote any local file or `dist/nimi-app-submission.json`
field into a release/permission claim.

When editing admission inputs:

- Keep `app_id: nimi.realm-persona-studio` identical across the manifest,
  `submission.yaml`, `scripts/pack.mjs`, Runtime/SDK callers, and the Tauri
  identifier. Do not introduce a second OS-bundle-only app identity.
- New scope declarations in `nimi.app.yaml` must carry an explicit
  `purpose:` and a real product justification — they are review transparency,
  not grants.
- Never add fields that claim grant/approval semantics
  (`permission_grant: granted`, `public_admission_truth: true`, etc.); the
  `scripts/local-audit.mjs` self-check rejects them.

## Verification

```bash
# Code layer
pnpm typecheck
pnpm test
pnpm lint

# Rust layer
(cd src-tauri && cargo check)
(cd src-tauri && cargo test)

# Spec layer
pnpm check:spec-consistency

# Pre-submission self-check (local-only; does not establish admission truth)
pnpm run validate       # manifest/submission/build-profile role markers
pnpm run local-audit    # admission inputs must defer truth to platform
pnpm run pack           # builds renderer + produces dist/nimi-app-submission.json
pnpm run check          # aggregate: validate + local-audit + spec-consistency + typecheck + lint + test
```

## CI

`.github/workflows/ci.yml` runs three jobs:

- `spec-and-typescript` — nimicoding doctor, spec consistency, typecheck,
  lint, vitest, renderer build (uploads `renderer-dist` artifact).
- `pre-submission-self-check` — needs `spec-and-typescript`, runs `validate`
  + `local-audit`, then re-packs the submission packet from the renderer
  artifact and uploads `nimi-app-submission`.
- `rust-quality` — cargo fmt/check/clippy/test on `src-tauri/`.

The self-check is pre-submission only. CI green does not constitute an
admission decision.

## Retrieval Defaults

Start with: `.nimi/spec/INDEX.md`, `.nimi/spec/project/kernel/`, `src/shell/renderer/app-shell/`, `src/shell/renderer/features/portfolio/`, `src-tauri/src/`.

Skip: `node_modules/`, `dist/`, `src-tauri/target/`, `src-tauri/gen/`, lockfiles.

## Code Conventions

- ULID for new app-level IDs.
- ISO 8601 for date/time fields.
- ESM imports use `.js` extension even for `.ts` files.
- Tauri host glue is consumed from `nimi-shell-tauri` (`crates.io` 0.1.0) and `@nimiplatform/kit/shell/renderer/bridge` (npm).

<!-- nimicoding:managed:agents:start -->
# Nimi Coding Managed Block

- Read .nimi/methodology, .nimi/spec, and .nimi/contracts before high-risk changes.
- Treat .nimi as the primary AI truth surface for this project.
- Treat `/.nimi/spec/**` as the current repo-wide product authority for this project, and use Git history for retired pre-cutover authority evidence.
- If .nimi/spec remains bootstrap-only, use .nimi/methodology/spec-reconstruction.yaml and .nimi/config/skills.yaml to drive AI-side truth reconstruction.
- Treat .nimi/methodology/spec-target-truth-profile.yaml as repo-local support guidance for future governance slices, not as the canonical reconstruction completion target or a guaranteed fresh-bootstrap seed.
- Treat .nimi/contracts/spec-reconstruction-result.yaml, .nimi/contracts/doc-spec-audit-result.yaml, .nimi/contracts/high-risk-execution-result.yaml, and .nimi/contracts/high-risk-admission.schema.yaml as machine contracts for reconstruction, audit, local-only high-risk closeout summaries, and canonical high-risk admission truth.
- Treat .nimi/config/skill-manifest.yaml, .nimi/config/host-profile.yaml, .nimi/config/host-adapter.yaml, .nimi/config/external-execution-artifacts.yaml, .nimi/config/skill-installer.yaml, .nimi/methodology/skill-runtime.yaml, .nimi/methodology/skill-installer-result.yaml, .nimi/methodology/skill-handoff.yaml, and admitted package-owned adapter profiles under adapters/**/profile.yaml as the canonical bridge to any external AI/skill execution.
- Treat standalone nimicoding as boundary-complete for bootstrap, handoff, validation, projection, and explicit admission only; do not assume packaged run-kernel, provider, scheduler, notification, or automation ownership.
- Treat .nimi/config/installer-evidence.yaml and .nimi/methodology/skill-installer-summary-projection.yaml as the operational-to-semantic installer projection boundary; do not promote concrete evidence artifacts into semantic truth.
- Treat high-risk external execution closeout, decision, ingest, and review payloads under .nimi/local/** as local-only operational projections; they do not promote semantic truth automatically, even when manager-owned.
- Use high-risk packetized execution only when authority, ownership, or cross-layer risk justifies it.
- Keep inline manager-worker as the default methodology posture; do not assume a separate worker runtime is mandatory.
- Keep code changes AI-context-efficient: favor bounded, cohesive files and split by responsibility during implementation instead of first concentrating unrelated logic into one file.
- Keep the methodology continuity-agnostic; do not assume daemon, heartbeat, or persistent manager ownership.
- Treat cutover readiness as preflight evidence only; the authority flip must come from an admitted cutover batch, not from readiness green by itself.
- Do not treat this managed block as a replacement for project-specific rules outside .nimi.
<!-- nimicoding:managed:agents:end -->
