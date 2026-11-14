## Android coordination package update — 2026-11-15

The existing 0.1.6 App consumes the complete frozen
`integration-20261114-android-http-rc.4` cohort from its own `.nimi/local/packages/`:
SDK **0.24.0-rc.2**, Kit **0.24.0-rc.4**, Windows native **0.24.0-rc.1**, and
App Tools **0.16.0-rc.2**. Kit keeps the declaration `^0.24.0-rc.1` and uses the
explicit rc.4 override. Old archives and candidates are preserved. The Android
plugin now includes `CoordinationHttpClient` and the verified idle-connection fix;
HTTP automatic retry remains disabled. Earlier intermittent failures are not all
assigned this cause.

The original Web origin, callback and client ID moved unchanged into
`local_development.web.local`, as required by the new tool. Use
`NIMI_DEV_REALM=local` for sync/check and Web/mobile builds, or
`pnpm dev:web -- --realm local`. Normal package sync refreshed managed projections.
There is no new source admission, App identity, Realm privilege, model selection,
canonical Persona or draft format in this upgrade.

Frozen offline installation, App Tools check, renderer/Host types, **402**
existing product tests and two actual remote-entry build regressions, Web/mobile
builds, Capacitor sync and offline Android assembly passed. The new APK is
`.nimi/local/android-candidates/realm-persona-studio-0.1.6-integration-kit-rc4-20261115-063014-debug.apk`
(**15,848,680 bytes**, SHA-256
`1e7563d88d88b87078184ec41408185ac50f9af858459efb37cafa6d41fcea2e`).
Its verified signer remains
`756e56a08527a94e830921233bc80f31121fd0fe57dccef1535e27e9eb0a6585`.
The candidate was subsequently installed over the original Android package
without clearing data and opened through the system launcher. Official Halliday
Continue reused the original source approval. The portfolio still contained the
original two Personas. Its Local drafts tab contained the original **Mira** /
**OASIS / CARING** draft `01M79NP9KHFX9PR8WAT4C746XD`, including the stored
cloud-library introduction, opening line and personality summary. After at least
**75 seconds** of natural foreground idle, formal Disconnect retired the private
view; the first Connect restored the two-Persona portfolio and the same Mira
draft, which reopened as **Automatically saved**. No AI, new draft, canonical
Persona, publication or data copy was used. Screenshots are
`.nimi/local/ui-audit/2026-11-15-kit-rc4/01-original-mira-draft.png` and
`02-first-idle-reconnect-mira.png`. Earlier real results retain their scope below;
this bounded pass does not diagnose every historical transient failure.

The updated formal HTTPS Web source was subsequently started normally at **4477**
after confirming the port was free. Official Halliday Continue reused the original
source approval and read the two existing Personas: **许一舟 / 末班车食堂** and
**Wren（雷恩） / 千风集**. Missing images/friend counts stayed explicitly unavailable.
Formal Disconnect retired the private view, and the first Connect restored the
same portfolio. The Web Local drafts tab actually showed **0**; no existing Web
draft baseline was established, so that empty Web list did not demonstrate loss
of the Android Mira draft. The later original Android source read and idle
reconnect above confirmed Mira remains intact. The App still reads the captured
scope's protected `creation/history.json`; the two observed source results are
not a claim of cross-source draft sharing. No AI, new Persona, deletion,
permission or Realm write was performed in this Web slice.

## Local Web / Android iteration — 2026-11-13

The 0.1.6 App consumes complete fixed SDK / Kit / Windows source-native `0.23.1-rc.1` and App Tools `0.15.1-rc.1` archives from `.nimi/local/packages/web-android-20261113-rc.1`, with matching declarations, overrides and lockfile. Content changes require a new candidate version. Desktop, Web and Android share the same scoped client, data lifecycle and protected operations; no Realm ownership privilege was added. Test package: `ai.nimi.apps.realmpersonastudio.dev`; client: `nimi.realm-persona-studio.android.dev`; callback: `ai.nimi.apps.realmpersonastudio.dev:/oauth/callback`. Build with JDK 21 / Android SDK, `pnpm sync:android`, then Gradle `assembleDebug`, or `pnpm dev:mobile`. Scheme and loopback cleartext are debug-only.

Actual fixed-candidate Android acceptance completed local Registry/Home approval and official Halliday login/direct access to My PC. Both existing Personas and their world names remained. The malformed “2 persona2}” counter was corrected and verified as “Personas: 2” in the rebuilt APK. An initial AI attempt lost its unsaved description after a connection interruption; normal separate autosave worked. Seed generation and description reroll now await the existing protected draft and history writes and refuse to submit AI after a failed save. The rebuilt APK showed saved input before generation; backgrounding during the test, reconnecting and continuing the draft recovered the complete v2 description without automatic resubmission. A subsequent explicit Gemma 4 26B request produced Mira's reviewable profile, automatically saved under Local drafts. Mira was not created or published to Realm; the original portfolio stayed at two Personas.

The 402 App tests plus two actual build-entry regressions, targeted lint, renderer/Host types and rebuilt Android APK pass. Screenshots include `android-draft-recovered.png` and `android-rc1-mira-candidate.png` in the existing UI audit directory. Intermittent `NIMI_MOBILE_NETWORK_UNAVAILABLE` during coordination is still unassigned; retry recovered. Media, canonical Realm creation/update, physical-device/network testing and public App Links remain **NOT-VERIFIED**. Earlier pending-admission notes below are historical and superseded by these observations.

The actual Desktop-supervised App read Halliday's existing two Personas and exact home-world names. Missing pictures and friend counts remained visibly unavailable. At 360px the 260px sidebar previously squeezed the content into a single-character column. Mobile now starts with a collapsed rail, opens navigation as a full-width view, and returns to content when a route is selected. The real Assets route was reached this way; resizing back restored the original expanded Desktop preference without overwriting it. Controls in the rail are at least 44px. Screenshots: `.nimi/local/ui-audit/2026-11-13-web-android`. This is real shared-renderer UX evidence; full accessibility, touch-keyboard and authenticated Android journeys remain unverified.

The earlier Vite module-graph checks reproduced and prevent the wrong Desktop entry in Web/mobile output. App Tools and 206-unit authority check/compile remain applicable, and install/sync/check plus fresh Web/mobile builds passed for the fixed cohort. Android login, AI drafts and recovery are now exercised above. The existing Web source remains admitted locally; no production Registry, existing Realm record or public release was changed.

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
