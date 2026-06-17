# Spec Index

`.nimi/spec/**` is the active product/app contract source for Realm Persona Studio in this repository. Topic notes, renderer screenshots, conversation summaries, generated artifacts, and `.nimi/local/**` execution state are evidence, not authority.

## Active Authority

| Surface | Role |
|---------|------|
| `.nimi/spec/INDEX.md` | This index. Thin guidance. |
| `.nimi/spec/project/AGENTS.md` | Module-level AI agent instructions for spec edits. Thin guidance. |
| `.nimi/spec/project/kernel/**.md` | Canonical product/app contract (`product_authority`). |
| `.nimi/spec/project/kernel/tables/**.yaml` | Canonical contract tables (`product_authority_table` / `support_registry`). |

## Read Order

1. `.nimi/spec/INDEX.md` (this file)
2. `.nimi/spec/project/kernel/index.md` (kernel authority entry; declares the rule ID format and the kernel doc set)
3. `.nimi/spec/project/kernel/core-rules.md` (cross-cutting kernel invariants)
4. Target domain kernel doc (`product-scope.md`, `realm-persona-object.md`, ...)
5. `.nimi/spec/project/kernel/tables/rule-catalog.yaml` (full enumerated rule registry)

## Rule ID Format

Every rule body lives in a kernel doc and carries an explicit identifier. The identifier format and prefix table are declared in `project/kernel/index.md`; the full enumerated registry is `project/kernel/tables/rule-catalog.yaml`. This index does not restate identifiers or rule bodies.

## Non-Authority Surfaces

| Surface | Role |
|---------|------|
| `.nimi/methodology/**` | Package-canonical nimicoding projection (do not hand-edit). |
| `.nimi/contracts/**` | Package-canonical nimicoding projection (do not hand-edit). |
| `.nimi/config/**` | Package-canonical nimicoding projection (project-local overrides via `host-overlay.yaml` only). |
| `.nimi/local/**` | Local-only operational state, audit, handoff results, projection artifacts. Gitignored. Never authority. |
| `.nimi/cache/**` | Local cache. Gitignored. Never authority. |
| `.nimi/topics/**` | Human-authored topic lifecycle reports. Evidence inputs only after absorption into the kernel. |

To refresh package-canonical projections after bumping `@nimiplatform/nimi-coding`, run `pnpm exec nimicoding start --yes` (non-destructive; only writes missing seed files).

## Verification

```bash
pnpm exec nimicoding doctor
pnpm exec nimicoding validate-spec-tree
pnpm exec nimicoding validate-placement --profile nimi --root .nimi/spec
pnpm exec nimicoding validate-table-family --profile nimi --root .nimi/spec
pnpm run check:spec-consistency
pnpm run typecheck
pnpm run test
pnpm run lint
```
