# Realm Persona Studio Spec AGENTS

This is the module-level AI agent instruction surface for the Realm Persona Studio canonical product/app contract under `.nimi/spec/project/**`. Read `.nimi/spec/INDEX.md` first, then this file, before editing.

## Authority Layout

- `kernel/index.md` is the admitted kernel authority entry. It declares the rule identifier format, the kernel doc set, and the kernel table set.
- `kernel/core-rules.md` defines cross-cutting kernel invariants. Domain kernel docs are expected to stay consistent with the cross-cutting invariants; conflicts are resolved by revision, not by paraphrase.
- Other `kernel/*.md` docs carry domain rules under the identifier namespace declared by `kernel/index.md`.
- `kernel/tables/rule-catalog.yaml` is the full enumerated registry of every admitted rule identifier. It stays in sync with the kernel docs.

## Editing Rules

This file is thin guidance and does not restate rule bodies or identifiers. The rules below cover the editing workflow itself, not product rules:

1. `.nimi/spec/project/kernel/**` is the active product/app authority root for Realm Persona Studio in this repo. Parallel roots (e.g. `apps/realm-persona-studio/spec/**`, repo-root `spec/**`, sibling `.nimi/spec/<other>/**`) are not opened.
2. Adding, removing, or rewording a rule statement requires editing both the affected kernel doc AND `kernel/tables/rule-catalog.yaml` in the same change. Catalog drift is treated as a fail-closed offense and is rejected by `pnpm run check:spec-consistency`.
3. New domain prefixes require updating the prefix table in `kernel/index.md`, adding a kernel doc that owns the prefix, and extending the catalog.
4. Inline rule identifier format inside kernel docs is documented in `kernel/index.md`. One identifier per atomic obligation; compound English may carry multiple sequential identifiers.
5. Topic files under `.nimi/topics/**` are evidence inputs only after their contents are absorbed into a kernel doc; they are not parallel authority.
6. Scope expansion (Realm lifecycle ownership, Realm scheduling, LocalAgent private state, world-created agent management) is rejected at edit time; those expansions are out of scope per the kernel.
7. Acceptance claims based only on renderer tests, partial feature wiring, or browser screenshots are rejected; final acceptance is governed by `kernel/product-acceptance-and-execution-plan.md`.

## Reconstruction History

This kernel set was reconstructed from the prior flat `spec/**` doc set via `nimicoding spec_reconstruction` on 2026-05-25. Per-file reconstruction audit lives at `.nimi/local/state/spec-generation/spec-generation-audit.yaml`; closeout result at `.nimi/local/handoff-results/spec_reconstruction.json`.
