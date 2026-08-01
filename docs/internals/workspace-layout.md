# Workspace layout

> For maintainers. Using Piku Code? See [docs/user](../user/).

A pnpm workspace driven by [vite-plus](https://vite.plus) (`vp`). See [scripts.md](./scripts.md) for
the task commands.

## apps

- `apps/server` (`piku`): the execution runtime and the published CLI. Owns orchestration, provider
  drivers, checkpointing, VCS, terminals, filesystem access, auth, and the HTTP + WebSocket surface.
  Also serves the built web app.
- `apps/web` (`@piku/web`): React + Vite UI. Consumes the shared client runtime and adds routing,
  components, and web-specific platform layers.
- `apps/desktop` (`@piku/desktop`): Electron shell for macOS and Linux. Supervises a desktop-scoped
  `piku` backend and loads the web bundle over the `piku://` protocol.

## packages

- `packages/contracts` (`@piku/contracts`): shared Effect Schema definitions. RPC group,
  orchestration commands/events/read model, auth scopes, environment descriptors, settings.
- `packages/shared` (`@piku/shared`): framework-agnostic utilities used by server and clients
  (`DrainableWorker`, git and source-control helpers, relay auth and signing, DPoP, semver, logging,
  observability, and more).
- `packages/client-runtime` (`@piku/client-runtime`): connection lifecycle, authorization, RPC
  session, environment registry, and Atom-based domain state shared by every client. See its
  [README](../../packages/client-runtime/README.md).
- `packages/effect-acp` (`effect-acp`): Effect client and agent implementation of the Agent Client
  Protocol, used by ACP-speaking provider drivers.
- `packages/effect-codex-app-server` (`effect-codex-app-server`): Effect client for the
  `codex app-server` JSON-RPC protocol.

## Other top-level directories

- `scripts/`: workspace tooling run through `vp run`. Dev runner, desktop artifact builds, release
  helpers, update-manifest merging.
- `assets/`: brand and app icon sources per channel (`dev`, `nightly`).
- `patches/`: pnpm patches for pinned upstream dependencies.
- `oxlint-plugin-pikucode/`: repo-specific lint rules.
- `docs/`: this documentation tree.

## Import conventions

`@piku/shared` and `@piku/client-runtime` use explicit subpath exports with no barrel index and
no root export. Import the narrow path (`@piku/shared/DrainableWorker`,
`@piku/client-runtime/state/threads`) rather than the package root. Files that are not exported
are implementation details. `@piku/contracts` does export a root alongside `./settings` and
`./relay`.
