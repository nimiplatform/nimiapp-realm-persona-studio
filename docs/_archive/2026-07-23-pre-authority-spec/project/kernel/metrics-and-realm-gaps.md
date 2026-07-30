---
id: SPEC-REALM-PERSONA-STUDIO-METRICS-GAPS-001
title: Metrics And Realm Gaps
status: active
owner: "@team"
updated: 2026-06-18
---

# Metrics And Realm Gaps

- **[R-RPS-METRIC-001]** friendCount is displayed only when Realm core or an admitted social source returns it for the persona.
- **[R-RPS-METRIC-002]** Missing friendCount renders as source unavailable and must not be zero-filled.
- **[R-RPS-METRIC-003]** Source availability is a visible state for list and detail surfaces.
- **[R-RPS-METRIC-004]** World names and world previews must come from WorldCore reads.
- **[R-RPS-METRIC-005]** The app must not maintain a local world catalog as product authority.
- **[R-RPS-METRIC-006]** Adoption, quota, friendship, engagement, and revenue metrics remain unavailable until admitted source fields exist.
- **[R-RPS-METRIC-007]** Bundle-size, build, local-audit, and screenshot results are operational evidence and cannot alter product authority.
- **[R-RPS-METRIC-008]** Any new metric must define owner, source field, unavailable state, and failure semantics before use.
