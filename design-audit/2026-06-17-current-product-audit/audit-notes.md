# Realm Agent Studio Current Product Audit

Date: 2026-06-17
Scope: current Realm Agent Studio app structure, owner portfolio, create flow, agent cockpit, profile/settings, identity, content, schedule, and audience surfaces.

## Evidence Limits

- Product Design Browser/Chrome capture tools were not available in this session.
- I did not switch to Playwright because the Product Design audit contract requires asking before using it as a fallback.
- The audit is therefore grounded in the current code, i18n copy, style system, and `.nimi/spec/realm-persona-studio/canonical/**` authority, not fresh screenshots.
- Prior memory was used only as routing context; current conclusions were rechecked against current files.

## Core Verdict

Realm Agent Studio has strong product truth boundaries, but the user experience is still too close to an engineering compliance console. It correctly refuses pseudo-success, fake metrics, private Runtime leakage, and unadmitted Realm writes. The weak part is the positive experience: it does not yet make the owner feel that they are operating a durable public Agent IP through a coherent creative cockpit.

The app should not be judged as a traditional CRUD admin panel. Its product center should be the owner loop:

1. Decide what this agent is.
2. Generate and review candidate identity.
3. Publish source-backed public profile changes.
4. Create agent-authored content.
5. Watch source-backed audience signals.
6. Return to the next best improvement.

Current implementation has those primitives, but spreads them across many surfaces as forms, JSON disclosures, badges, and warnings.

## Main Problems

### 1. The top-level IA still starts from a portfolio, not from creative operation

Evidence:
- `src/shell/renderer/app-shell/routes.tsx` exposes `/portfolio`, `/portfolio/create`, per-agent routes, and `/ai-config`.
- `src/shell/renderer/app-shell/shell-layout.tsx` top nav is Portfolio, Create, AI setup.
- `src/shell/renderer/i18n/studio-copy.ts` describes the portfolio as the entry point and tells users to open an agent to continue work.

Problem:
The first mental model is still "manage a list of agents." For a future-grade studio, the first mental model should be "operate one or many public Agent IPs." Portfolio is needed, but it should be an operating dashboard with health, next actions, blocked source gaps, identity/content freshness, and audience state. Current portfolio cards are mostly identity and metric summaries.

### 2. Cockpit exists, but it is not yet the command center

Evidence:
- `agent-cockpit.tsx` renders next actions, maintenance suggestions, cards, and source inventory.
- Those actions navigate to Profile, Identity, Content, and Audience routes.

Problem:
Cockpit is still a summary page plus links. It does not own the end-to-end work queue. It should be the place where the owner sees the agent's current public state, unresolved gaps, candidate work waiting for review, and one or two ranked next actions. The current layout repeats source inventory and status evidence more than it orchestrates work.

### 3. Create is too much like a validation form

Evidence:
- `CreateRealmAgentWorkspace.tsx` combines source mode selection, seed generation, CharacterCard import, handle check, world selection, public fields, DNA, graph review, world preview, reference image generation, readiness preview, technical JSON, and final submit in one long workspace.
- The code has an explicit seed stage and edit stage, but the edit stage still presents a dense two-column form.

Problem:
This is a correct create contract, but not a great creator experience. The owner should feel a guided progression: Source -> AI Draft -> Graph Review -> Public Profile -> Visual Reference -> Realm Create -> Open Cockpit. Current UI makes the user read many badges and alerts to infer that progression.

### 4. Profile Studio is structurally overloaded

Evidence:
- `OwnerPortfolio.settings.tsx` contains public identity, behavior, communication style, Runtime proposal, raw-rule review note, profile cover read-only state, visibility settings, and Runtime projection workspace.

Problem:
It mixes three jobs: public profile editing, behavior/voice shaping, and runtime-readiness/projection. These are related but not the same user task. The result feels like an expert settings matrix, not a profile studio. The raw rule note and technical review also pull the screen toward internal semantics.

### 5. Identity Studio has candidates but lacks a real visual review surface

Evidence:
- `OwnerPortfolio.assets.tsx` can build an Identity Pack, generate image candidates, avatar package candidates, upload identity resources, synthesize voice demos, and show local history.
- Public publication is explicitly blocked where Realm write paths are not admitted.

Problem:
The candidate lifecycle is correct, but the surface is still mostly forms and technical result panels. Identity needs a visual canvas: current public avatar/cover, candidate board, selected candidate, review checklist, admitted write path, and blocked/deferred areas. Right now the owner has to mentally connect prompts, generated previews, upload result, avatar URL save, and local history.

### 6. Content Studio is a publishing workbench, but not an editorial studio

Evidence:
- `OwnerPortfolio.posts.tsx` includes content variant generation, Runtime copy proposal, caption/tags, attachments, uploads, text resources, human review, Realm publish, and local schedule.

Problem:
The parts are all present, but the hierarchy is wrong for writing and publishing. The user's primary object should be the post draft and its preview. Attachments, text resources, uploaded media, schedule, and technical payloads should support that object. Current UI makes every backend capability a peer section, so the main editorial action is diluted.

### 7. Audience Signals is truthful but too thin to justify a whole destination

Evidence:
- `agent-insights-page.tsx` shows friendCount, source availability, and deferred metrics.
- The spec allows only source-backed friendCount in the first version.

Problem:
This page is honest, but underpowered. It should either fold into Cockpit as an audience card, or become a richer "Audience Signals" page centered on the first-version metric plus operational implications: source availability, friendCount status, profile/content freshness, and what to improve next. A screen mostly saying "deferred" weakens confidence even if it is technically correct.

### 8. Technical evidence leaks too much into normal product surfaces

Evidence:
- Create, settings, assets, posts, schedule, visibility, and Runtime projection all expose technical details or JSON previews through visible disclosure controls.
- i18n copy includes many SDK-ish terms such as payload, Runtime transport, Realm Create Post, worldId evidence, checksum, Resource, Binding, profileCoverUrl.

Problem:
Disclosure is better than primary clutter, but this is still too present for an owner-facing creative studio. Industrial does not mean internal terms everywhere. Technical truth should stay available for audit/debug mode, while default product copy should say what the owner can do, what is blocked, and what evidence backs the state.

### 9. The visual system reads like a polished admin shell, not a future creative tool

Evidence:
- `styles.css` uses compact topbar/sidebar chrome, glass cards, grids, badges, and dense form sections.
- Most feature surfaces use cards, alerts, field shells, badges, and JSON panels.

Problem:
The app is clean, but too homogeneous. Everything is a panel. There is not enough contrast between portfolio overview, cockpit command center, creative canvas, editorial preview, and technical audit. A serious creative product needs distinct working modes, not only reusable cards.

### 10. AI is present as buttons, not as a visible collaborator

Evidence:
- Create has seed generation and reference image generation.
- Settings has Runtime proposal.
- Posts has Runtime copy.
- Assets has image, avatar package, and voice candidates.
- AI setup is a separate top-level route.

Problem:
AI is embedded correctly by spec, but experientially it appears as scattered action buttons. The owner needs a visible "Studio guidance" layer: what AI can help with now, what context it will use, what it produced, what changed, and what requires owner review. AI setup should support that layer, not feel like a separate configuration island.

## Interfaces To Redo

1. Agent Cockpit
Priority: P0
Redo as the operating home. It should own next-best-action ranking, unresolved source gaps, candidate review queue, current public profile snapshot, content state, and audience signal summary.

2. Create Realm Agent
Priority: P0
Redo as a staged creation flow: Source -> AI Draft -> Graph Review -> Public Profile -> Visual Reference -> Create -> Open Cockpit. Keep the same fail-closed contract, but move technical graph and payload details behind audit mode.

3. Identity Studio
Priority: P0
Redo as a visual review board. Primary objects: current public identity, generated candidates, uploaded candidate, voice sample, local history, and admitted public write action. Forms should support the board, not dominate it.

4. Content Studio
Priority: P0
Redo as an editorial canvas. Primary object: draft post preview with caption, tags, attachment preview, review state, publish/schedule actions. Resource creation/upload should be secondary tools.

5. Profile Studio
Priority: P1
Split into public profile, behavior/voice, and visibility/runtime readiness sections. The top should show current public profile and proposed changes, not a long settings field matrix.

6. Portfolio
Priority: P1
Elevate from list management to portfolio operations. Add health/status summaries, per-agent next action, source gaps, pending local candidates, and audience signal availability.

7. Audience Signals
Priority: P2
Either fold into Cockpit for first version or redesign as a compact source-backed signal page. Do not give a large standalone page to mostly deferred metrics.

8. AI Setup
Priority: P2
Keep it, but connect it to the creative workflow. Each creative action should show whether its required AI capability is ready and where to fix it.

## Recommended Redesign Order

1. Cockpit command center.
2. Create staged flow.
3. Identity visual review board.
4. Content editorial canvas.
5. Profile Studio split and copy cleanup.
6. Portfolio operations dashboard.
7. Audience/AI setup integration.

## Non-Negotiables To Preserve

- No fake public success.
- No zero-fill metrics.
- No LocalAgent private state.
- AI output remains candidate material until owner review and admitted Realm success.
- `friendCount` stays source-backed.
- Missing Realm/Runtime capability is a named product state, not a fallback.
- Keep `nimi-kit` as the interaction system unless a real kit gap is recorded.
