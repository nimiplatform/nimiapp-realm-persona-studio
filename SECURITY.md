# Security

## Credential custody

- Do not store Realm credentials, Runtime access tokens, or Runtime refresh tokens in this repository or in any app-local storage.
- **Runtime** owns app registration, active session admission, operation access enforcement, and Nimi credential custody (including access and refresh tokens). **Desktop** provides exact Electron Host supervision, process lifecycle management, and user management entrypoints.
- Studio must not render app-local login, initiate OAuth flows, exchange OAuth codes, persist or clear Runtime sessions, bootstrap Runtime defaults, or hold bearer/refresh tokens.

## Nimi client

- Use the local-app client constructed in `src/shell/renderer/app-shell/studio-platform.ts` via the host-bound `createNimiClient` paired with `createNimiLocalAppStandardShellSurface`.
- Do not introduce direct bare Runtime or Realm requests, legacy Tauri IPC paths, parallel Nimi client construction, custom unary transport, caller metadata injection, or app-managed Runtime registration.

## Permission posture

- Treat `app_access` domains declared in `nimi.app.yaml` (`realm.data`, `runtime.consume`) as capability declarations, not self-granted operational authorization. Active session admission and operation access are enforced by Runtime, while Registry/Platform review governs catalog approval and approved release descriptors (and any separate Integration standing resource permissions remain independent).
- Do not synthesize success on a typed contract gap (missing artifact, missing scope, or missing identity). Fail closed and surface a typed capability-unavailable state to the owner.

## Reporting a vulnerability

If you discover a vulnerability in Realm Persona Studio, do not open a public issue. Contact the Nimi Platform security team through the channel listed in the Nimi developer portal.
