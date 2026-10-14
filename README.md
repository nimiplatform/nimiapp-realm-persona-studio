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
