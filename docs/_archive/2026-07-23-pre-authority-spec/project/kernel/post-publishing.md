---
id: SPEC-REALM-PERSONA-STUDIO-POST-PUBLISHING-001
title: Persona Post Publishing
status: active
owner: "@team"
updated: 2026-07-11
---

# Persona Post Publishing

- **[R-RPS-POST-001]** Post drafts are owner-reviewed local candidates until Realm post creation returns canonical post identity.
- **[R-RPS-POST-002]** Copy assistance may use only owner-visible persona fields, owner prompt text, and reviewed local draft state.
- **[R-RPS-POST-003]** Post publish must not expose caller-selected world destination when Realm resolves author/world context server-side.
- **[R-RPS-POST-004]** Attachment drafts must reference reviewed media candidates or canonical Realm resources; missing resources fail closed.
- **[R-RPS-POST-005]** The app must not publish from private LocalAgent state, hidden provider state, or unreviewed Runtime output.
- **[R-RPS-POST-006]** Local schedule stores at most one foreground executable draft per persona and is not Realm schedule authority.
- **[R-RPS-POST-007]** Publish success requires Realm response identity; a scheduled local action is not publish success.
- **[R-RPS-POST-008]** Post failures preserve the draft and display source failure without retrying through alternate legacy routes.
- **[R-RPS-POST-009]** Until an exact Runtime-mediated post/resource operation is admitted, post publication, text-resource creation, attachment-resource reads, media upload, and scheduled publish are visibly disabled. Draft editing, review, payload preview, and local schedule candidate persistence remain local candidate behavior and must not invoke Realm or ordinary network transport.
