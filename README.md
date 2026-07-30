# nimiapp-realm-persona-studio

Realm Persona Studio — Owner-facing creation and operation desktop app for user-owned public Realm Personas. Packaged as a Tauri 2 / Electron 42 + React 19 desktop app.

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

Normative product authority lives under
[`.nimi/spec/realm-persona-studio/canonical/`](./.nimi/spec/realm-persona-studio/canonical/).

## Architecture

| Layer | Technology | Location |
|-------|-----------|----------|
| Desktop shell | Tauri 2 + Electron 42 | `src-tauri/`, `src-electron/` |
| Renderer | React 19 + Vite 7 + Tailwind 4 | `src/shell/renderer/` |
| Routing | react-router-dom 7 | `src/shell/renderer/app-shell/routes.tsx` |
| Auth & runtime bridge | Desktop-supervised protected standard bridge | `src-electron/` |
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
# Desktop-supervised Electron (active development path)
pnpm dev

# Explicit alias for the same active path
pnpm dev:electron

# Renderer-only, intentionally without protected operations
pnpm dev:renderer
```

## Build & Verify

```bash
pnpm build                            # typecheck + vite build + cargo check
pnpm test                             # vitest run
pnpm check:spec-consistency           # spec authority surface check
pnpm lint                             # typecheck + eslint + cargo check
```

The Tauri identifier remains reserved for future packaging work, but Tauri is
not an active development path in this rollout.

## Desktop-Supervised Protected Session

Realm Persona Studio inherits Runtime account state from the Nimi desktop host.
It is a Desktop-supervised App, not a login or OAuth broker:

- The app does not render `DesktopShellAuthPage`.
- The app does not open OAuth, exchange OAuth codes, or save/load/clear Runtime sessions.
- The app does not own access tokens, refresh tokens, Runtime defaults, or Runtime app registration.
- Missing Desktop shared Runtime account state renders an explicit capability-unavailable state.

Realm and Runtime calls require separately admitted public Nimi kit / SDK
operations delivered through the protected standard bridge.

## Routes

| Route | Purpose |
|-------|---------|
| `/portfolio` | Current-user owner-created persona list, search, filter, sort, source warnings |
| `/portfolio/create` | Create a Realm Persona (handle preflight, world select, identity fields) |
| `/portfolio/:personaId` | Current public profile, ownership, world, state, friendCount |
| `/portfolio/:personaId/settings` | Visibility + setting proposal + SourceMaterializationPacket materialization |
| `/portfolio/:personaId/settings/review` | Runtime consistency review (advisory critique) |
| `/portfolio/:personaId/assets` | Avatar, profile cover, post-image candidates |
| `/portfolio/:personaId/assets/voice` | Voice-demo candidates via `audio.synthesize` |
| `/portfolio/:personaId/posts` | Persona-authored post draft, attachment, publish |
| `/portfolio/:personaId/posts/schedule` | Single app-local foreground-only post schedule |
| `/portfolio/:personaId/insights` | friendCount, source availability, stale warnings |

## Spec Authority

Normative product authority lives in closed v2 containers under
[`.nimi/spec/realm-persona-studio/canonical/`](./.nimi/spec/realm-persona-studio/canonical/).
Use `nimicoding authority query` or bounded `authority context` to retrieve
exact IDs.

Studio canonical owner portfolio surfaces are
`Realm WorldCoreController.listRealmPersonas` and
`Realm WorldCoreController.getRealmPersona`. Create/update use
`createRealmPersona` and `replaceRealmPersona`; home-world reads use
`listWorldCores` / `getWorldCore`; runtime materialization uses
`createSourceMaterializationPacket`. `/api/creator/agents`,
`/api/agent/forge-imported-system/**`, and `/api/agent/dev/my-agents` are
explicitly non-current legacy anti-targets and must not be promoted into owner
portfolio surfaces.

`.nimi/methodology/authority-authoring.yaml` is managed by
`@nimiplatform/nimi-coding`; refresh it with
`pnpm exec nimicoding sync --apply` after bumping the package. Validate the
canonical corpus with `pnpm run spec:authority:check` and
`pnpm run spec:authority:compile`.

## License

[MIT](./LICENSE)
