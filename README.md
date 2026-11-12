## Local Web / Android iteration — 2026-11-13

The 0.1.6 App now consumes complete SDK / Kit / native 0.23.0 and App Tools 0.15.0 archives from `.nimi/local/packages`. Desktop, Web and the new local Android entry share the same scoped client, query/data lifecycle and protected operations; no Realm operation or ownership privilege was added. The test package is `ai.nimi.apps.realmpersonastudio.dev`, client `nimi.realm-persona-studio.android.dev`, callback `ai.nimi.apps.realmpersonastudio.dev:/oauth/callback`. Use JDK 21 / Android SDK, `pnpm sync:android`, then Android Gradle `assembleDebug`, or `pnpm dev:mobile`. Scheme and loopback cleartext are debug-only.

The actual Desktop-supervised App read Halliday's existing two Personas and exact home-world names. Missing pictures and friend counts remained visibly unavailable. At 360px the 260px sidebar previously squeezed the content into a single-character column. Mobile now starts with a collapsed rail, opens navigation as a full-width view, and returns to content when a route is selected. The real Assets route was reached this way; resizing back restored the original expanded Desktop preference without overwriting it. Controls in the rail are at least 44px. Screenshots: `.nimi/local/ui-audit/2026-11-13-web-android`. This is real shared-renderer UX evidence; full accessibility, touch-keyboard and authenticated Android journeys remain unverified.

Actual Vite build module graphs reproduced and now prevent the wrong Desktop entry in Web/mobile output. App Tools, authority check/compile (206 units), i18n, renderer/Host types, lint, 400 App tests and two build-entry regressions pass. Android debug builds. New Android Registry/Home approval, Android login/direct access, AI, media import, mutations and background recovery are **NOT-VERIFIED** pending user credential/admission steps. The existing Web source is already admitted locally; no production Registry, Realm record or public release was changed.

Historical cross-end baseline (2026-11-10) starts from https://github.com/nimiplatform/nimiapp-realm-persona-studio at 8bac0d5 (pre-launch). Desktop and Web share the existing Persona, private-draft and media workflows through Kit Nimi sessions. Realm keeps canonical resource ownership and hash-CAS. Runtime keeps credentials, AI and App storage. The Studio has no separate account system, global current client or production-wide query cache.

This checkout selects complete SDK 0.22.2, Kit/native 0.22.1 and App Tools 0.14.0 source archives in ignored .nimi/local/packages through pnpm-workspace overrides; package.json retains public version declarations. The native archive matches the Windows source Runtime profile. Remote resource support requires Nimi d48ac2b89 or later: WorldCore list/get and owner PersonaCharacter CRUD only, with existing realm.data admission. Public publication lifecycle, posts, media publication, materialization and unavailable metrics remain unavailable.

Run pnpm install --frozen-lockfile, pnpm sync and pnpm validate. pnpm dev uses the existing Desktop-supervised registration (explicit --resume when needed). pnpm dev:web serves the declared HTTPS source; copy .env.web.example to .env.web.local with trusted TLS paths. The source needs Registry admission and first Home confirmation; neither is created by this configuration. pnpm build:web builds the website, and pnpm build retains the Desktop build. Appearance and private content are read after connection. Use one editing client for local drafts/assets at a time; these files do not gain automatic concurrent-edit merging.

Historical checks (2026-11-10): 396 tests, renderer/Host types, language audit, lint, App Tools validation and Web/Desktop builds pass. Actual supervised Desktop displayed Halliday's two owned Personas and exact WorldCore names; missing pictures/metrics remained visibly unavailable. Chrome 4477 displayed the shared Nimi login entry. New Web source consumption, full AI/media/editor and Realm-write journeys remain NOT-VERIFIED while source admission/Home confirmation and the recorded Windows test-permission dialog remain pending. No public deployment, package release or mobile parity is claimed. Visual-preview/Storybook contexts and unit operation fixtures are explicitly separate from Runtime acceptance. Older notes retain their original version/platform scope.

[App introduction and usage](NIMI_APP.md)

# Realm Persona Studio (角色工坊)

> The creation, incubation, and operations studio for user-owned AI characters and digital personas.

Realm Persona Studio is a desktop creative suite built for creators, authors, and worldbuilders who want to incubate durable, living AI characters. From psychological archetypes and visual portraits to vocal tone and creative writing drafts, Persona Studio gives you full artistic control over your characters' digital identities within the open Realm ecosystem.

---

## Creative Studio Workflow

### 1. Persona Identity & Lore
- Craft detailed character profiles covering backstory, personality traits, moral compass, and dialogue habits.
- Co-write with your selected local or cloud AI to generate prompt-grounded greetings, core behavioral boundaries, and distinctive speaking mannerisms.

### 2. Visual Identity & Asset Gallery
- Generate AI portrait candidates, character concept art, and profile banners.
- Import external reference images (`PNG`, `JPEG`, `WebP`, or `GIF`, up to 8 MiB) into your private local asset library.
- Manage character poses, expressions, and outfit variations.

### 3. Voice & Acoustic Audition
- Assign distinctive vocal profiles to your persona.
- Preview and audition spoken dialogue lines across different emotional tones.

### 4. Feed & Post Composition
- Draft social feed posts and diary entries directly in your persona's authentic voice.
- Maintain one local schedule candidate per persona. Saving a draft keeps it locally—post publication, media uploads, and scheduled publishing are currently unavailable.

### 5. Realm Synchronization
- Sync supported `PersonaCharacter` profile changes to Realm under your authenticated owner account.
- Local drafts and saved Realm profiles remain separate. Saving updates the Realm record under its visibility settings; it is distinct from publication lifecycle actions, which remain disabled when unavailable.

---

## Technical Architecture

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Desktop Shell** | Desktop-supervised Electron | Native host integration and protected Nimi access |
| **Renderer UI** | React 19 + Vite + Tailwind CSS | Fluid component design using `@nimiplatform/kit` |
| **Routing & State** | React Router 7 + Zustand | Multi-persona navigation and reactive draft state |
| **Platform Integration** | `@nimiplatform/sdk` | Protected Realm profile access, AI inference, and local asset candidates |

---

## Getting Started & Development

### Prerequisites
- Node.js ≥ 24, pnpm ≥ 10
- Running Nimi Desktop with an active user account

### Running Locally
```bash
# Install dependencies
pnpm install

# Start in Desktop-supervised Electron shell
pnpm dev
```

### Verification & Testing
```bash
# Typecheck and build
pnpm build

# Run unit tests
pnpm test

# Verify specification consistency and run linting
pnpm check:spec-consistency
pnpm lint

# Launch component Storybook
pnpm storybook
```

---

## Data Custody & Privacy

- **Local Creative Drafts**: Saved character drafts, image candidates, local schedules, and post ideas stay in local App storage.
- **Realm Profiles & AI Routing**: Supported profile writes use your authenticated owner account. AI co-writing follows your selected inference route; when using a cloud route, relevant draft input is sent to the selected provider.

---

## Release & Verification Status

- **Verified Publisher Release**: [v0.1.6](https://github.com/nimiplatform/nimiapp-realm-persona-studio/releases/tag/v0.1.6)
- **Registry Admission**: [#86](https://github.com/nimiplatform/nimi-app-registry/pull/86) (macOS arm64 and Windows x64)
- **Recorded Toolchain Combination**: SDK 0.21.0, Kit/native 0.19.3, App Tools 0.12.1, Nimi Coding 0.6.5
- **Previously Recorded Platform Checks**: macOS arm64 Catalog install, AI generation of character greeting and traits (Bluebird-743), local candidate persistence, and private Realm profile creation verified. (Windows GUI execution marked as `NOT-VERIFIED`).

### 2026-11-10 Web development check

The admitted local HTTPS source completed official Nimi sign-in and direct Runtime access. The browser read the owner Persona list, WorldCore names and Wren detail. Fixed a real JSON storage path error for Realm identifiers containing punctuation; draft and schedule keys now use a bounded digest. A post draft saved from Web was read again after disconnect/reconnect. SDK-path regression tests, 397 App tests, types/lint and i18n checks passed. Realm publishing, profile replacement and full AI/media workflows were not verified in this check. Local package updates require restarting a running development server before checking the new code.
