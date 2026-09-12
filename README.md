# nimiapp-realm-persona-studio

角色IP的孵化中心

Realm Persona Studio — Owner-facing creation and operation desktop app for user-owned public Realm Personas. Packaged as a Electron 42 + React 19 desktop app.

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
- Composing persona-authored post drafts and a single local schedule per persona; Realm publication is currently unavailable
- Showing source availability for adoption signals (`friendCount`); no value is shown until an admitted source supplies it

It is **not** a LocalAgent runtime center, world maintenance tool, Forge
package editor, team collaboration platform, or performance analytics suite.

Normative product authority lives under
[`.nimi/spec/realm-persona-studio/canonical/`](./.nimi/spec/realm-persona-studio/canonical/).

## Architecture

| Layer | Technology | Location |
|-------|-----------|----------|
| Desktop shell | Desktop-supervised Electron 42 | `src-electron/` |
| Renderer | React 19 + Vite 7 + Tailwind 4 | `src/shell/renderer/` |
| Routing | react-router-dom 7 | `src/shell/renderer/app-shell/routes.tsx` |
| Auth & runtime bridge | Desktop-supervised protected standard bridge | `src-electron/` |
| UI components | `@nimiplatform/kit` (npm) | renderer-wide |
| Platform client | `@nimiplatform/sdk` (npm) | `src/shell/renderer/app-shell/studio-platform.ts` |
| State | Zustand | `src/shell/renderer/app-shell/app-store.ts` |

## Prerequisites

- Node.js ≥ 24
- pnpm ≥ 10

## Install

```bash
pnpm install
```

All runtime dependencies resolve from npm (`@nimiplatform/kit`,
`@nimiplatform/sdk`); no sibling
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
pnpm build                            # typecheck + renderer and Electron builds
pnpm test                             # vitest run
pnpm check:spec-consistency           # spec authority surface check
pnpm lint                             # typecheck + eslint
pnpm storybook                        # local component and page fixtures, port 6006
pnpm build:storybook                  # .nimi/local/storybook; also built in CI
```

Storybook covers portfolio, creation and reference sources, overview, settings,
identity and voice, post drafting and management, assets, AI configuration, and
writing/voice loading and failure controls. The development banner identifies
fixture data; a Storybook-only module supplies settings read fixtures. Other
protected reads without a host remain unavailable, and no AI, storage, or Realm
write is replaced with a successful response. Storybook verifies
presentation only; acceptance uses the supervised Electron App through CDP.

Local image imports use the published protected artifact upload/read operations
and a metadata index at `assets/imported.json`. PNG, JPEG, WebP and GIF files up
to 8 MiB are supported. Audio file import awaits published SDK/Kit audio MIME
admission. Removing an imported entry does not delete Runtime-managed bytes.

## Desktop-Supervised Protected Session

Realm Persona Studio inherits Runtime account state from the Nimi desktop host.
It is a Desktop-supervised App, not a login or OAuth broker:

- The app does not render `DesktopShellAuthPage`.
- The app does not open OAuth, exchange OAuth codes, or save/load/clear Runtime sessions.
- The app does not own access tokens, refresh tokens, Runtime defaults, or Runtime app registration.
- Missing Desktop shared Runtime account state renders an explicit capability-unavailable state.

Realm and Runtime calls require separately admitted public Nimi kit / SDK
operations delivered through the protected standard bridge.

## Creation and maintenance

Start with an idea, choose an inspiration prompt, or ask AI to invent a character.
AI drafts a public introduction, an opening line, a compact identity, specific
behavior and speaking principles, and clear boundaries. Review these in four
steps: introduction, personality, optional visual reference, and Realm creation.
The live preview shows the actual draft writing; it does not simulate a chat.
Creation starts private, and the owner reviews visibility and a source-backed
home world before submitting. Drafts save locally through protected storage and
reopen at the editing stage when character writing already exists.

The character settings workspace starts with a natural-language AI revision
request. Suggestions show current and proposed text and can be adopted one at a
time. Adopting a suggestion only edits the draft. A suggestion cannot overwrite
a field edited after generation started. Saving uses the latest owner read,
preserves unrelated profile fields and existing relationship postures, and
rejects content conflicts without discarding the owner's writing.

| Route | Purpose |
|-------|---------|
| `/portfolio` | Owner character collection and local creation drafts |
| `/portfolio/create` | Idea, AI character draft, live preview, and reviewed creation |
| `/portfolio/:personaId` | Profile overview and next creative actions |
| `/portfolio/:personaId/settings` | AI-assisted public profile and character writing maintenance |
| `/portfolio/:personaId/identity` | Visual identity and voice candidates |
| `/portfolio/:personaId/posts` | Persona-authored post draft and local schedule |
| `/portfolio/:personaId/posts/manage` | Local content management |
| `/assets` | Local creative asset library |
| `/ai-config` | App-owned AI configuration through the canonical kit surface |

`/visual-preview.html` is a development-only visual entry with a persistent
example-data label. It is excluded from the production build. It cannot establish
AI generation, Realm writes, or platform admission; use the Desktop-supervised
app for those checks.

## Spec Authority

Normative product authority lives in closed v2 containers under
[`.nimi/spec/realm-persona-studio/canonical/`](./.nimi/spec/realm-persona-studio/canonical/).
Use project-local `pnpm exec nimicoding authority query` or bounded
`pnpm exec nimicoding authority context` to retrieve exact IDs.

Studio owner Realm Personas are canonical PersonaCharacters consumed through
the host-injected `@nimiplatform/sdk/app` surface:
`client.realm.personaCharacter.listOwned/getOwned/create/replace`. Replacement
uses `toProfileInput` and the latest `baseContentHash`; home-world reads use the
admitted `client.realm.worldCore` surface. Runtime source materialization is
not admitted and remains fail-closed. `/api/creator/agents`,
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

## Windows package and release

The production target is Windows x86_64 using Desktop-supervised Electron.
Build and inspect the package from this repository:

```bash
pnpm run sync
pnpm exec nimi-app check --production
pnpm exec nimi-app test
pnpm exec nimi-app build --target windows-x86_64 --production
pnpm exec nimi-app pack --target windows-x86_64 --production
```

Before tagging, follow the [GitHub release setup guide](https://github.com/nimiplatform/nimi/blob/main/app-tools/README.md#publishing-on-github), including the `NIMI_REPOSITORY_ADMIN_TOKEN` Actions secret.
A protected annotated version tag on the repository default branch runs the managed build, provenance and immutable Release workflow.
The publisher then submits the immutable Release to [Nimi App Registry](https://github.com/nimiplatform/nimi-app-registry). Registry admission is a separate human review; local builds and GitHub Releases do not create admission or installed state.
