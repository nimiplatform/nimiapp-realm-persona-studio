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
| Desktop shell | Tauri 2 + Electron 42 | `src-tauri/`, `src-electron/` |
| Renderer | React 19 + Vite 7 + Tailwind 4 | `src/shell/renderer/` |
| Routing | react-router-dom 7 | `src/shell/renderer/app-shell/routes.tsx` |
| Auth & runtime bridge | Desktop-supervised protected standard bridge | `src-electron/` |
| UI components | `@nimiplatform/kit` (npm) | renderer-wide |
| Platform client | `@nimiplatform/sdk` (npm) | `app-shell/studio-platform.ts` |
| State | Zustand | `app-shell/app-store.ts` |
| Workspace surface preparation | Build linked SDK/Kit dist before typed gates | `prepare:workspace-surfaces` in `package.json` |
| Dev port | 1450 | `vite.config.ts` |
| Dev port cleanup | Manual stale-listener cleanup; never wired into the exact doctor-controlled renderer command | `scripts/ensure-dev-renderer-port.mjs` |

## Spec Authority & Sync

Closed v2 containers under `.nimi/spec/realm-persona-studio/canonical/**` are
Realm Persona Studio's canonical product/app authority. Read only the affected
containers or bounded authority context; do not create parallel authority roots
(`apps/realm-persona-studio/spec/**`, repo-root `spec/**`, sibling
`.nimi/spec/<other>/**`).

`.nimi/methodology/authority-authoring.yaml` is the package-managed authoring
guide; refresh with `pnpm exec nimicoding sync --apply` after bumping the
package.

The current spec-4 Nimi App Access surface admits owner PersonaCharacter
portfolio, detail, create, replace, and private owner delete through the host-injected
`client.realm.personaCharacter.listOwned/getOwned/create/replace/delete` methods under
`realm.data`; writes use the complete PersonaCharacter profile contract,
`replace` uses `toProfileInput` plus the latest `baseContentHash`, and ordinary
delete is exposed only for private owner-created PersonaCharacters. The Studio UI
may call this product object Realm Persona, but legacy RealmPersona DTO and
controller names are not callable authority. Publication lifecycle, unpublish
or retirement, media upload, materialization, and friendCount gaps must fail
closed until an exact operation exists. `/portfolio` must not call Forge-imported system,
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
- Studio does **not** render app-local login, open OAuth, exchange OAuth codes, save Runtime sessions, load Runtime sessions, clear Runtime sessions, or bootstrap Runtime defaults.
- All Runtime account state is Desktop shared auth owned by the supervisor and consumed through the protected standard bridge / public SDK Runtime account surface.
- Missing Desktop shared Runtime account state is a fail-closed capability-unavailable product state, not a redirect to a Studio-owned login flow.

## Development Principles

### No legacy, no shims
- This project starts standalone. There is no prior deployed version, no migration burden.
- No compatibility layers, adapters, or shims.
- No "simple version first, fix later" shortcuts.
- No backward-compatible fallback logic.
- Full storybook scope from day one.

### Fail-close
- Missing platform client → fail-close, show capability unavailable in product copy.
- Realm API failure → show typed failure category (`realm-unavailable`, `access-denied`, etc.), not silent retry.
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
pnpm run doctor
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
pnpm run check          # aggregate: doctor + validate + local-audit + spec-consistency + i18n + typecheck + lint + test
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

Start with: `.nimi/spec/realm-persona-studio/canonical/`, `src/shell/renderer/app-shell/`, `src/shell/renderer/features/portfolio/`, `src-tauri/src/`.

Skip: `node_modules/`, `dist/`, `src-tauri/target/`, `src-tauri/gen/`, lockfiles.

## Code Conventions

- ULID for new app-level IDs.
- ISO 8601 for date/time fields.
- ESM imports use `.js` extension even for `.ts` files.
- Tauri host glue is consumed from `nimi-shell-tauri` (`crates.io` 0.1.0) and `@nimiplatform/kit/shell/renderer/bridge` (npm).

<!-- nimicoding:managed:agents:start -->
# Nimi Coding Managed Block

- Product authority lives under `.nimi/spec/**`.
- For canonical authority authoring, read only `.nimi/methodology/authority-authoring.yaml`, the affected authority files or bounded task context, and CLI diagnostics.
- Use `nimicoding authority context <path> <id> --max-units <n> --max-bytes <n> --json` only for the complete declared outgoing interpretation closure; it is not complete task context, and failure never permits guessed or partial context.
- Use `nimicoding authority diff` and `authority impact` with explicit `--max-bytes`; impact reports declared review obligations and does not prove implementation, consumers, or tests are synchronized.
- Use `nimicoding authority change-candidates` only with explicit channels and budgets; its complete union is recall input, never conflict, retirement, absence, authority, or conformance judgment.
- Under `.nimi/spec/**`, author only closed multi-unit `*.authority.yaml` containers or single-unit `*.authority.md`; historical document formats are unsupported and never inferred.
- Run `nimicoding authority fmt` on each changed file, then `nimicoding authority check` on the complete authority input set.
- Never bypass a failure with inferred or fallback semantics; choose repair values only from product/task authority.
- Keep derived and local verification output under `.nimi/local/**`; it is never product authority.
<!-- nimicoding:managed:agents:end -->
