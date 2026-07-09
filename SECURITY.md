# Security

## Credential custody

- Do not store Realm credentials, Runtime access tokens, or Runtime refresh tokens in this repository or in any app-local storage.
- All Runtime account state is host-owned Desktop shared auth consumed through the Nimi installed app standard shell / SDK Runtime account bridge; refresh-token custody lives in Runtime, outside Studio.
- Studio must not render app-local login, open OAuth, exchange OAuth codes, save Runtime sessions, load Runtime sessions, clear Runtime sessions, bootstrap Runtime defaults, or hold access/refresh tokens.

## Nimi client

- Use the app-scoped `NimiClient` constructed in `src/shell/renderer/app-shell/studio-platform.ts` with Nimi SDK / kit mediated installed app Runtime account transport.
- Do not introduce parallel Nimi client construction paths, custom Realm unary transport, caller metadata, Runtime app registration, token custody, or runtime defaults fallback in Studio.

## Permission posture

- Treat the scopes declared in `nimi.app.yaml` as review transparency, not grants. Permission grants are platform-owned.
- Do not synthesize success on a typed contract gap (missing artifact, missing scope, missing identity). Fail-close and surface a typed capability-unavailable state to the owner.

## Reporting a vulnerability

If you discover a vulnerability in Realm Persona Studio, do not open a public issue. Contact the Nimi Platform security team through the channel listed in the Nimi developer portal.
