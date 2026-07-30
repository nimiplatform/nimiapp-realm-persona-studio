# Realm Agent Studio Product Design Audit

Date: 2026-06-17
Scope: Product, UI, UX, and accessibility audit for the current Realm Agent Studio app as an owner-facing agent creation and operation tool.
Method: Product Design audit workflow using local spec authority, current renderer implementation, i18n copy, tests/fixtures, and a live Browser capture of the renderer bootstrap state.

## Evidence

- Screenshot: `01-real-render-portfolio-bootstrap.png`
- Live URL checked: `http://127.0.0.1:1450/#/portfolio`
- Live render result: Vite/browser render stops at Runtime bootstrap failure: `tauri-ipc Runtime transport requires window.__TAURI__.core.invoke or __NIMI_TAURI_RUNTIME__.invoke`.
- Product authority: `.nimi/spec/realm-persona-studio/canonical/**`
- UI implementation: `src/shell/renderer/app-shell/**`, `src/shell/renderer/features/**`, `src/shell/renderer/i18n/studio-copy.ts`, `src/shell/renderer/styles.css`

## User Goal

普通用户要能低门槛创建自己喜欢的 Realm Agent，并持续维护其 profile、头像、profile cover、声音、post message/image/voice、排期和基础统计。AI 应该像创作协作者，而不是隐藏的自动化黑箱；所有 AI 输出必须保持候选态，经过 owner review 和 Realm/Runtime 成功返回后才成为公开真相。

## Overall Health

Current product foundation is strong on authority boundaries and fail-closed semantics, but the experience reads more like an engineering control panel than a consumer-grade creative studio. The main issue is not missing primitives; the app already has Agent Creation Graph, candidate assets, post variants, schedule, settings proposals, source availability, and AI model configuration. The issue is that these surfaces are arranged as separate technical workspaces instead of one guided creative operating loop.

Health: medium.

## Strengths

1. The app respects the product truth boundary. AI output, local schedule, creative assets, post drafts, and unavailable metrics are consistently treated as candidates or source gaps rather than fake success.
2. The creation flow has a serious domain model: source mode, CharacterCard import, graph review, write plan, world preview, handle check, reference image, and readiness preview.
3. Agent Cockpit is the right conceptual hub after creation. The spec requires routing graph-created agents into cockpit maintenance, and the implementation already has cockpit cards, next actions, maintenance suggestions, and source inventory.
4. Portfolio supports search, filter, sort, source warnings, and source-backed friendCount handling.
5. The app uses kit primitives and shared shell patterns rather than inventing a separate interaction system.

## Critical UX Risks

1. Information architecture is too thin at the top level.
   Current top navigation exposes Portfolio, Create, and AI Models. The real product value lives deeper under per-agent tabs: detail, settings, assets, posts, insights. For a normal user, this hides the creative loop behind a portfolio-first structure.

2. Creation flow is too cognitively dense.
   Source mode, graph review, manual fields, DNA, world preview, readiness JSON, and reference image all appear in one workspace. This is precise, but it does not yet shape complexity into a beginner-safe path.

3. AI assistance is fragmented by surface.
   AI appears in seed generation, reference image, settings proposal, consistency review, identity generation, voice demo, post copy, and AI model config. The product lacks one coherent "AI creative assistant" layer that tells users what AI can help with next for this specific agent.

4. Candidate vs public truth is correct but overly technical.
   Badges like candidate-only, source-backed, app-local, foreground-only, Realm save, summary-only are accurate. They should remain, but the primary user copy should translate them into product language: draft, ready to review, saved to Realm, local only on this device, blocked by missing Realm write path.

5. Settings, assets, posts, and schedule are separate tools, not one production pipeline.
   A user creating an agent needs a sequence: define identity, generate look, generate voice sample, draft first post, review, publish. Today those tasks are reachable, but the journey is not orchestrated.

6. Metrics/insights surface is structurally honest but product-light.
   Since only friendCount is admitted, insights correctly avoid fake analytics. The opportunity is to make it an "audience signal and source health" view rather than a sparse analytics page.

7. Visual language feels operational and glass-card heavy.
   The shell is polished, but dense cards with many badges can make every state look equally important. A creative product should make the current asset/post/profile preview more visually dominant than technical evidence.

8. Accessibility risk: icon-only global nav depends on tooltips.
   Sidebar items have aria labels, which is good, but discoverability for ordinary users is weaker than a labeled nav, especially for Create vs Portfolio vs AI Models.

## Recommended Product Reframe

Reframe Realm Agent Studio as an "Agent Creative Operating Studio" with four owner-facing zones:

1. Home / Portfolio
   Show agents, drafts, source gaps, and next best actions across the portfolio.

2. Create Agent
   A guided creation flow with progressive disclosure:
   Source -> AI draft -> Review graph -> Public identity -> Visual/voice starter pack -> Realm create -> Agent Cockpit.

3. Agent Cockpit
   The main per-agent home. It should lead with a live public profile preview and a "next production step" panel, then place settings/assets/posts/insights as mode tabs.

4. AI Setup
   Keep AI Models as a setup/health surface, but connect it contextually to blocked AI actions instead of making users understand it up front.

## Proposed UI/UX Restructure

### Portfolio

- Keep list/filter/sort, but add an "Action needed" lane before the full grid.
- Show each agent card as: public preview, source state, next action, friendCount/source status.
- Replace first-level "AI Models" prominence with a small global AI readiness indicator unless setup is blocking.
- Add local draft recovery if creation is interrupted.

### Create Agent

Split the current single workspace into a guided stepper:

1. Start From
   Describe, Manual, CharacterCard, Remix Agent. Keep Remix disabled only if it shows why and what is required.

2. AI Draft
   Generate or import source. Show "what was understood" and "what needs your decision".

3. Review Graph
   Keep the graph model, but show section cards grouped as Identity, Personality, World/Context, Voice, Visual, Post Ideas, Write Plan. Technical source mapping goes behind disclosure.

4. Public Profile
   Handle, display name, description, DNA, world. World preview sits beside world selection only.

5. Starter Pack
   Optional reference image, avatar direction, voice demo prompt, first post idea. Make clear what is only candidate material.

6. Create
   One final review page: visible public fields, blocked/deferred items, Realm create action, and post-create route to Cockpit.

### Agent Cockpit

- Make cockpit the default home after creation and for agent detail.
- First viewport should show a public profile preview: cover, avatar, display name, handle, description, greeting, friendCount/source state.
- Add one prominent "Next best action" panel derived from current source gaps and local candidates.
- Convert settings/assets/posts/insights tabs into production modes:
  Profile, Identity, Content, Audience, Source.

### Profile / Settings

- Merge visibility and profile settings into a clearer "Public Profile" page.
- Put Runtime consistency review inline as "Review with AI" instead of a separate hidden route.
- Keep technical JSON preview behind disclosure.
- Keep profile cover write blocked state, but make it actionable: "Realm does not yet admit owner cover writes; save as candidate or use avatar URL path."

### Identity / Assets

- Rename Assets to Identity Studio.
- Lead with current public avatar/cover/voice sample preview.
- Then show candidate board: avatar URL, generated image, avatar package, uploaded resource, voice demo.
- Each candidate card should have three states: Local candidate, Realm-ready candidate, Public in Realm.
- The current owner-scoped write gaps should be visible in a compact "publication path" panel.

### Content / Posts

- Rename Posts to Content Studio.
- Put AI post variants, copy proposal, caption/tags, attachments, review, publish in one left-to-right or top-to-bottom pipeline.
- Schedule should be a mode inside Content Studio, not a hidden sub-route, because it is a state of a reviewed local draft.
- Show post publish success only with Realm post id, as current code already requires.

### Audience / Insights

- Reframe as Audience Signals.
- Keep friendCount as the only metric, but pair it with source availability and deferred signals.
- Do not show empty analytics charts. Show "not admitted yet" as a designed state, not as a missing dashboard.

### AI Setup

- Keep full AI model config, but normal users should reach it through contextual blockers: text/image/audio generation unavailable.
- Global nav can show AI readiness as a small status indicator rather than a primary creative destination.

## Step List And Health

1. Bootstrap / auth boundary: healthy. The browser render fails closed with a clear Runtime transport error instead of fake data.
2. Portfolio: medium. Source-backed list controls are solid, but cross-agent next actions and creative recovery are missing.
3. Create source selection: medium. Good source model, but step purpose and disabled remix need more user-facing shape.
4. Agent Creation Graph review: strong model, medium UX. Correct candidate/truth boundary, too technical for primary path.
5. Create public fields and world selection: medium. Correct gates, but field complexity needs progressive disclosure.
6. Reference image generation: medium. Useful starter asset, currently attached as a form section rather than part of an identity starter pack.
7. Agent Cockpit: promising. Correct hub concept, but needs a stronger public profile preview and one dominant next action.
8. Settings/profile: medium. Correct owner-scoped save and AI proposal pattern, but split review route and technical copy dilute the workflow.
9. Identity/assets: medium. Rich candidate machinery, but users need a board/pipeline view instead of separate controls.
10. Content/posts: medium. Strong review/publish safeguards, but post creation, attachments, resources, and schedule need a single production flow.
11. Schedule: healthy boundary, weak placement. App-local foreground-only state is correct but should live inside Content Studio.
12. Insights: healthy boundary, low perceived value. It should be Audience Signals, not a sparse analytics dashboard.
13. AI config: functional but too prominent. It is a setup dependency, not a primary creative task for ordinary users.

## Implementation Waves

Wave 1: Navigation and copy hard cut.
- Rename Assets -> Identity Studio, Posts -> Content Studio, Insights -> Audience.
- Make Agent Cockpit the main per-agent landing surface.
- Add labeled sidebar or expanded nav mode for ordinary users.
- Move AI Models to secondary setup/status affordance unless blocked.

Wave 2: Creation stepper.
- Split CreateRealmAgentWorkspace into guided steps without changing write semantics.
- Preserve Graph Review, Readiness Preview, and technical details behind progressive disclosure.
- Add final review summary and post-create Cockpit handoff.

Wave 3: Cockpit-first production loop.
- Add public profile preview and one dominant next action.
- Reframe cards into Profile, Identity, Content, Audience, Source.
- Surface local creative/post candidates in Cockpit.

Wave 4: Studio boards.
- Identity Studio: candidate board with publication path.
- Content Studio: post pipeline with variant board, attachment readiness, review, publish, schedule.
- Profile Studio: inline AI review and visibility/settings save.

Wave 5: Accessibility and visual QA.
- Verify keyboard traversal through stepper, tabs, candidate cards, disclosure panels, and modal/popover controls.
- Check contrast and focus rings on glass cards and status badges.
- Test responsive layout for the create two-column view and dense post/assets controls.

## Non-goals For This Refactor

- Do not add fake analytics beyond friendCount.
- Do not create public profile cover writes until Realm admits the owner path.
- Do not turn local schedule into campaign/queue automation.
- Do not expose LocalAgent memory, private runtime state, or chat in Studio.
- Do not collapse Runtime candidate output into Realm truth.
