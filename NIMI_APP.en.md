# Realm Persona Studio User Guide

Welcome to Realm Persona Studio! Design, refine, and organize your own Realm Personas in one workspace—shaping character lore, visual identity candidates, voice auditions, and local post drafts before syncing profile updates to Realm.

---

## Getting Started & Core Workflow

### 1. Shape Character Lore & Persona Profiles
- Open **My Personas** to continue refining an existing character, or select **Create Persona** to start a new local draft.
- Define each character's name, handle, home world, backstory, personality traits, greeting, speaking style, and behavioral boundaries.
- Co-write with your configured local or cloud AI model to draft and polish character concepts, greetings, and structured profile settings. All AI output remains candidate material until you review and apply it.

### 2. Visual Identity & Private Asset Library
- Generate portrait and concept-art candidates with AI, or import reference images (`PNG`, `JPEG`, `WebP`, or `GIF`, up to 8 MiB per image) into your private local asset library.
- Keep reference artwork attached to drafts and review candidates locally before choosing how to present your persona.

### 3. Voice Selection & Line Audition
- Pick a preset voice from your configured speech provider for each persona.
- Enter representative dialogue lines to synthesize and play local audition clips, checking tone and pacing directly inside the studio.

### 4. Persona Post Drafts & Local Schedule Candidate
- Draft social posts and diary entries in your persona's voice, organized alongside a per-persona draft queue.
- Save up to one app-local schedule candidate per persona to plan upcoming entries.
- *Note: Post publishing, media uploads, and automated scheduled publishing to Realm are not yet available and appear visibly unavailable in the interface. Saved local schedule candidates never auto-publish.*

### 5. Local Drafts & Realm Synchronization
- Confirm local saves succeed as you iterate; if a save fails, your draft stays preserved so you can retry without losing work.
- When a persona profile is ready, create or update your owner `PersonaCharacter` record in Realm. Saving profile fields and public publication lifecycle actions remain separate; unsupported publication actions stay clearly marked unavailable.

---

## PC & AI Model Requirements

Configure the AI capabilities below in **AI Config** inside Realm Persona Studio. Model installation, local runtimes, and shared cloud connections are managed in **Nimi Home** on your primary PC:
- **`text.generate` (Text Generation)**: Used for persona concept drafting, profile suggestions, and post copy refinement.
- **`image.generate` (Image Generation)** *(optional)*: Used to generate character portrait and visual reference candidates.
- **`audio.synthesize` (Speech Synthesis)** *(optional)*: Used to synthesize and audition spoken persona lines.

---

## Data Handling, Accounts & Privacy

- **Private Storage on Your PC**: Unpublished creation drafts, post drafts, local schedule candidates, creative history, and imported image references are stored in Nimi's private App storage on your host PC. Edit local drafts and assets from one client at a time—concurrent edits across multiple windows are not automatically merged. Non-sensitive interface language preferences in browser local storage inside the desktop Host technical profile may remain after uninstalling the app.
- **Realm Sync & AI Routing**: Supported owner persona reads and updates use your signed-in Nimi account over a protected session. AI co-writing follows your selected Local or Cloud route; when using a Cloud route, only the draft input needed for that request is sent to the chosen provider.
- **Desktop, Web & Mobile Access**: The desktop app launches from Nimi Home and follows its active account. The hosted Web companion is available from the [Nimi App Storefront](https://nimi.ai/apps/realm-persona-studio) or [realm-persona-studio.nimi.xyz](https://realm-persona-studio.nimi.xyz/) using official Nimi sign-in—first-time Web access requires one-time confirmation in Nimi Home (**Settings → Account Security → Remote access**), and your host PC's Nimi Home and Runtime must remain online and reachable. Narrow windows collapse the sidebar by default; use the top-left menu button to reopen navigation. Android is currently for local testing only and not yet generally released.
- **Disconnecting & Signing Out**: Signing out waits for pending saves and prompts before discarding unsaved edits. If the network or session drops, private views close immediately and in-flight generations are not replayed; reconnecting restores previously saved records. Closing a browser tab does not stop your PC Runtime.

---

## Limitations & Support

- **Current Boundaries**: Realm post publishing, media uploads, automatic scheduled publishing, public publication lifecycle actions, and friend-count metrics remain visibly marked as unavailable wherever platform support is not yet open; the app never fabricates placeholder counts or synthetic success states.
- **Help & Feedback**: Source code and documentation are maintained in the [GitHub repository](https://github.com/nimiplatform/nimiapp-realm-persona-studio). Report bugs or feature questions via [GitHub Issues](https://github.com/nimiplatform/nimiapp-realm-persona-studio/issues).
