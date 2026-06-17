# nimiapp-realm-persona-studio

Realm Persona Studio — Owner-facing creation and operation desktop app for user-owned public Realm Personas. Packaged as a standalone Tauri 2 + React 19 desktop app.

> Migrated from the `apps/realm-persona-studio` workspace in the `nimi-realm`
> monorepo. The nimi-realm copy remains in place pending manual removal;
> this project is the canonical standalone distribution.

## What this is

Realm Persona Studio is the creation and operation center where an owner
incubates, ships, and operates user-owned public **Realm Personas** as durable
persona IP. It supports:

- Building a coherent persona identity (personality, worldview, role)
- Managing public settings through natural language + AI assistance
- Cultivating visual identity (avatar, profile cover candidates, post images)
- Composing and publishing persona-authored posts to the Realm feed
- Monitoring source-backed adoption signals (`friendCount`)

It is **not** a LocalAgent runtime center, world maintenance tool, Forge
package editor, team collaboration platform, or performance analytics suite.

Normative product authority lives under [`.nimi/spec/project/kernel/`](./.nimi/spec/project/kernel/).

## Architecture

| Layer | Technology | Location |
|-------|-----------|----------|
| Desktop shell | Tauri 2 | `src-tauri/` |
| Renderer | React 19 + Vite 7 + Tailwind 4 | `src/shell/renderer/` |
| Routing | react-router-dom 7 | `src/shell/renderer/app-shell/routes.tsx` |
| Auth & runtime bridge | `nimi-shell-tauri` (crates.io) | `src-tauri/src/main.rs` |
| UI components | `@nimiplatform/kit` (npm) | renderer-wide |
| Platform client | `@nimiplatform/sdk` (npm) | `src/shell/renderer/app-shell/studio-platform.ts` |
| State | Zustand | `src/shell/renderer/app-shell/app-store.ts` |

## Prerequisites

- Node.js ≥ 24
- pnpm ≥ 10
- Rust (stable) + Cargo, with the Tauri 2 toolchain for `src-tauri`

## Install

```bash
pnpm install
```

All runtime dependencies resolve from npm (`@nimiplatform/kit`,
`@nimiplatform/sdk`) and crates.io (`nimi-shell-tauri`); no sibling
`nimi-realm` checkout is required.

## Development

```bash
# Renderer only (vite dev server on http://127.0.0.1:1450)
pnpm dev:renderer

# Full Tauri shell (renderer + native window)
pnpm dev:shell
```

## Build & Verify

```bash
pnpm build                            # typecheck + vite build + cargo check
pnpm test                             # vitest run
pnpm check:spec-consistency           # spec authority surface check
pnpm lint                             # typecheck + eslint + cargo check
```

## Login flow

Realm Persona Studio inherits the Runtime account session from the Nimi
desktop shell. On first launch:

1. `runStudioBootstrap` loads `RuntimeDefaults` and constructs a
   first-party Runtime client (`@nimiplatform/sdk`).
2. If no Runtime account session exists, the kit's `DesktopShellAuthPage`
   renders the login UI; on success, Runtime owns refresh-token custody and
   projects an account identity into the app store.
3. Once authenticated, the shell renders the workspace shell with the owner
   storybook routes (Portfolio, Create, Detail, Settings + Review, Assets +
   Voice, Posts + Schedule, Insights).

Access tokens are pulled on-demand via Runtime; this app **does not** persist
access or refresh tokens locally (PO-SHELL-008 / K-ACCSVC-008 equivalent).

## Routes

| Route | Purpose |
|-------|---------|
| `/portfolio` | Current-user owner-created persona list, search, filter, sort, source warnings |
| `/portfolio/create` | Create a Realm Persona (handle preflight, world select, identity fields) |
| `/portfolio/:personaId` | Current public profile, ownership, world, state, friendCount |
| `/portfolio/:personaId/settings` | Visibility + setting proposal + RuntimeSourceSnapshot materialization |
| `/portfolio/:personaId/settings/review` | Runtime consistency review (advisory critique) |
| `/portfolio/:personaId/assets` | Avatar, profile cover, post-image candidates |
| `/portfolio/:personaId/assets/voice` | Voice-demo candidates via `audio.synthesize` |
| `/portfolio/:personaId/posts` | Persona-authored post draft, attachment, publish |
| `/portfolio/:personaId/posts/schedule` | Single app-local foreground-only post schedule |
| `/portfolio/:personaId/insights` | friendCount, source availability, stale warnings |

## Spec Authority

Normative product authority lives under [`.nimi/spec/project/kernel/`](./.nimi/spec/project/kernel/)
(kernel-style: per-domain kernel docs plus an enumerated rule catalog at
[`tables/rule-catalog.yaml`](./.nimi/spec/project/kernel/tables/rule-catalog.yaml)).
Top-level index is [`.nimi/spec/INDEX.md`](./.nimi/spec/INDEX.md); editing rules
are in [`.nimi/spec/project/AGENTS.md`](./.nimi/spec/project/AGENTS.md). Every rule
carries an explicit `R-RPS-<DOMAIN>-NNN` identifier.

Studio canonical owner portfolio surfaces are
`Realm WorldCoreController.listRealmPersonas` and
`Realm WorldCoreController.getRealmPersona`. Create/update use
`createRealmPersona` and `replaceRealmPersona`; home-world reads use
`listWorldCores` / `getWorldCore`; runtime materialization uses
`createRuntimeSourceSnapshot`. `/api/creator/agents`,
`/api/agent/forge-imported-system/**`, and `/api/agent/dev/my-agents` are
explicitly non-current legacy anti-targets and must not be promoted into owner
portfolio surfaces.

`.nimi/{config,contracts,methodology}/**` are package-canonical projections from
`@nimiplatform/nimi-coding`; refresh with `pnpm exec nimicoding start --yes`
after bumping the package. The full nimicoding spec validator suite is
`pnpm exec nimicoding doctor && pnpm exec nimicoding validate-spec-tree && pnpm exec nimicoding validate-spec-audit && pnpm exec nimicoding validate-placement --profile nimi --root .nimi/spec && pnpm exec nimicoding validate-table-family --profile nimi --root .nimi/spec`.

## License

[MIT](./LICENSE)
