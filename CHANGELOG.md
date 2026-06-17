# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Standalone packaging of Realm Persona Studio migrated from the `apps/realm-persona-studio` workspace in `nimi-realm`.
- React Router 7 routing across the ten storybook routes (Portfolio, Create, Detail, Settings + Review, Assets + Voice, Posts + Schedule, Insights).
- Login flow built on `@nimiplatform/kit/auth` `DesktopShellAuthPage` and `nimi-shell-tauri` OAuth bridge, replacing the previous external-broker-only stub.
- Glass-morphism shell built with `@nimiplatform/kit/ui` `Surface material="glass-thick"` surfaces, sidebar tooltips, and ambient mesh background.

### Changed
- Switched build dependencies from `workspace:*` (monorepo) to published versions: `@nimiplatform/kit ^0.1.2`, `@nimiplatform/sdk ^0.5.14`, `nimi-shell-tauri = 0.1.0`.
- Replaced workspace `useState<StudioWorkspace>` routing with `react-router-dom` `BrowserRouter` + lazy routes.
- Replaced ad-hoc bootstrap React state machine with a Zustand-backed shell store mirroring the parentos pattern.
