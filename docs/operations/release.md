# Release Checklist

> For maintainers. Using Piku Code? See [docs/user](../user/).

Nightly is the only release channel. There is no stable, latest, or alpha release path.

## What the workflow does

- Workflow: `.github/workflows/release.yml`
- Triggers:
  - scheduled nightly check every three hours
  - manual `workflow_dispatch` (no inputs; it produces a nightly release just like the schedule)
- Runs quality gates first: lint, typecheck, test.
- Reads the shared production Piku Connect relay URL and Clerk client configuration before packaging clients.
- Builds three artifacts in parallel:
  - macOS `arm64` DMG
  - macOS `x64` DMG
  - Linux `x64` AppImage
- Publishes one GitHub Release with all produced files.
  - Every run is published as a GitHub prerelease and is never marked as the repository's latest release.
  - Automatically generated release notes are pinned to the previous nightly tag.
- Includes Electron auto-update metadata (`nightly*.yml` and `*.blockmap`) in release assets.
- Publishes the CLI package (`apps/server`, npm package `piku`) with OIDC trusted publishing from the same workflow file, always to npm dist-tag `nightly`.
- Deploys the hosted web app to Vercel only after a release is published, aliased to the `nightly` hosted app channel.
- Signing is optional and auto-detected per platform from secrets.

## Required release credentials

The release workflow requires these GitHub Actions secrets in addition to the platform and deployment
credentials documented below:

- `RELEASE_APP_ID`
- `RELEASE_APP_PRIVATE_KEY`

The GitHub Release job uses them to mint the token that publishes release assets. Nightly releases
never commit version bumps back to `main`, so there is no finalize job.

## Piku Connect relay deployment

The relay is a shared control plane versioned separately from client releases. All nightly client
builds point at the same relay so users see the same linked environments.

`.github/workflows/deploy-relay.yml` deploys Alchemy stage `prod` on every push to `main`. The
release workflow reads the relay URL and Clerk client configuration from the existing `production`
GitHub Actions environment before building desktop, CLI, or hosted web artifacts.

Required repository variables shared by relay deployments:

- `CLOUDFLARE_ACCOUNT_ID`
- `PLANETSCALE_ORGANIZATION`
- `AXIOM_ORG_ID`

Required repository secrets shared by relay deployments:

- `CLOUDFLARE_API_TOKEN`
- `PLANETSCALE_API_TOKEN_ID`
- `PLANETSCALE_API_TOKEN`
- `AXIOM_TOKEN`

Required `production` environment variables:

- `RELAY_API_ZONE_NAME`
- `RELAY_TUNNEL_ZONE_NAME`
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_JWT_AUDIENCE`
- `CLERK_JWT_TEMPLATE`
- `CLERK_CLI_OAUTH_CLIENT_ID`
- `APNS_ENVIRONMENT`
- `APNS_TEAM_ID`
- `APNS_KEY_ID`
- `APNS_BUNDLE_ID`

Optional `production` environment variables:

- `RELAY_DOMAIN` when overriding the derived `relay.<RELAY_API_ZONE_NAME>` domain

Required `production` environment secrets:

- `CLERK_SECRET_KEY`
- `APNS_PRIVATE_KEY`

The account-scoped repository credentials are consumed by Alchemy while provisioning relay stages; they
are not bound into the relay Worker. The production deployment uses an Axiom personal access token,
so `AXIOM_ORG_ID` must accompany `AXIOM_TOKEN`. The `prod` stage owns the retained PlanetScale
database. Local personal stages provision isolated branches from it and are never deployed by CI.
Production adopts the configured relay API and tunnel DNS zones as retained Cloudflare resources.
Personal stages reference the production-owned zones.

Developers deploy personal stages locally rather than through pull-request automation:

```sh
vp run --filter pikucode-relay deploy -- --stage "$USER" --env-file .env.local
```

## Hosted web app release deployment

The hosted app is intentionally not deployed by Vercel's Git integration. The
web project disables automatic Git deployments in `apps/web/vercel.ts` via
`git.deploymentEnabled: false`, and `.github/workflows/release.yml` deploys the
web app with Vercel CLI after the GitHub Release succeeds.

Required GitHub Actions secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Optional GitHub Actions variables:

- `VERCEL_TEAM_SLUG`: overrides the Vercel CLI scope when the team slug is preferred over the `VERCEL_ORG_ID` secret.
- `PIKU_WEB_ROUTER_URL`: defaults to `https://app.pikucode.dev`.
- `PIKU_WEB_NIGHTLY_DOMAIN`: defaults to `nightly.app.pikucode.dev`.

Required Vercel domains:

- `nightly.app.pikucode.dev`: the only channel alias, updated by every release.

The release deploy job rewrites release package versions before upload so the
hosted app's About panel renders the release version. Each deploy aliases the new
deployment to `nightly.app.pikucode.dev` only. The job always passes
`VITE_HOSTED_APP_CHANNEL=nightly`.

One-time Vercel dashboard setup:

1. Confirm the web project root directory remains `apps/web`.
2. Add the nightly domain above to the web project.
3. Disable automatic Git deployments in the dashboard if desired; the committed
   `vercel.ts` setting is the source-of-truth, but disconnecting Git in the
   dashboard is also safe.

## Nightly release details

- Publishes a GitHub prerelease only:
  - tag format: `vX.Y.Z-nightly.YYYYMMDD.<run_number>`
  - `nightly-v...` is accepted only as a legacy previous-nightly tag
  - release name includes the short commit SHA
  - `make_latest` is always `false`
- Uses the next patch version as the nightly base. For example, `0.0.17` produces nightlies on `0.0.18-nightly.*`.
- Publishes Electron auto-update metadata to the `nightly` updater channel.
- Publishes the CLI package (`apps/server`, npm package `piku`) to the `nightly` npm dist-tag using the same nightly version.
- Does not commit version bumps back to `main`.

## Server self-update release invariant

Connected servers update to the client's exact version, not to an npm dist-tag. Every released
desktop or hosted client version must therefore have a matching `piku@<version>` package available on
npm before users can receive that client.

The workflow enforces this ordering:

1. `publish_cli` publishes the exact nightly version to npm.
2. `release` depends on `publish_cli` before exposing desktop artifacts in GitHub Releases.
3. `deploy_web` depends on `release` before moving the hosted nightly alias to the new client.

Preserve these dependencies when changing the release graph. Publishing a client first would leave
the **Update server** action targeting a package version that does not exist yet.

For a release smoke test, confirm `npm view piku@<version> version` returns the expected version, then
connect the new client to a server on the previous version and verify that the update action
reconnects to the matching server. Test one automatic path and the manual or desktop-managed
guidance when those environments are available.

## Desktop auto-update notes

- Updater runtime: `apps/desktop/src/updates/DesktopUpdates.ts`.
- `electron-updater` adapter: `apps/desktop/src/electron/ElectronUpdater.ts`.
- `apps/desktop/src/main.ts` only wires the updater layers into the desktop runtime.
- Update UX:
  - Background checks run on startup delay + interval.
  - No automatic download or install.
  - The desktop UI shows a rocket update button when an update is available; click once to download, click again after download to restart/install.
- Provider: GitHub Releases (`provider: github`) configured at build time.
- Repository slug source:
  - `PIKU_DESKTOP_UPDATE_REPOSITORY` (format `owner/repo`), if set.
  - otherwise `GITHUB_REPOSITORY` from GitHub Actions.
- Required release assets for updater:
  - platform installers (`.dmg`, `.AppImage`, plus macOS `.zip` for Squirrel.Mac update payloads)
  - channel metadata: `nightly*.yml`
  - `*.blockmap` files (used for differential downloads)
- macOS metadata note:
  - `electron-updater` reads `nightly-mac.yml` for both Intel and Apple Silicon.
  - The workflow merges the per-arch mac manifests into one mac manifest before publishing the GitHub Release.

## 0) npm OIDC trusted publishing setup (CLI)

The workflow invokes `node apps/server/scripts/cli.ts publish` after aligning package versions. That
script temporarily prepares the `piku` package, then runs `vp pm publish --filter piku ...` from the
repository root so workspace publish configuration is applied correctly.

Checklist:

1. Confirm npm org/user owns package `piku` (or rename package first if needed).
2. In npm package settings, configure Trusted Publisher:
   - Provider: GitHub Actions
   - Repository: this repo
   - Workflow file: `.github/workflows/release.yml`
   - Environment (if used): match your npm trusted publishing config
3. Ensure npm account and org policies allow trusted publishing for the package.
4. Every scheduled or dispatched run will:
   - align the release package versions to the resolved nightly version
   - build web + server
   - invoke the CLI publish script with npm dist-tag `nightly`

## 1) Release validation and unsigned builds

There is no dry-run or dispatch path that skips publishing. Tag pushes no longer trigger the
workflow at all; the only triggers are the schedule and a manual `workflow_dispatch`.

Use normal CI or local quality gates to validate checks and builds without shipping. A manual
dispatch publishes a real nightly npm package, GitHub prerelease, desktop updater release, and
hosted nightly alias. Only run it when a real nightly release is acceptable. Omitting signing
secrets only makes platform artifacts unsigned; it does not prevent publication.

## 2) Apple signing + notarization setup (macOS)

Required secrets used by the workflow:

- `CSC_LINK`
- `CSC_KEY_PASSWORD`
- `APPLE_API_KEY`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER`
- `MACOS_PROVISIONING_PROFILE` (base64-encoded provisioning profile with Associated Domains)

Required repository variables:

- `APPLE_TEAM_ID`

Optional repository variables:

- `CLERK_PASSKEY_RP_DOMAINS`: comma-separated RP-domain override. By default, the build derives the
  domain from the production Clerk publishable key.

Checklist:

1. Apple Developer account access:
   - Team has rights to create Developer ID certificates.
2. Create an explicit App ID for `dev.pikucode.app` and enable Associated Domains.
3. Create a `Developer ID Application` certificate and a compatible provisioning profile for that
   App ID with Associated Domains enabled.
4. Export the certificate + private key as `.p12` from Keychain.
5. Base64-encode the `.p12` and store as `CSC_LINK`.
6. Base64-encode the provisioning profile and store it as `MACOS_PROVISIONING_PROFILE`.
7. Store the `.p12` export password as `CSC_KEY_PASSWORD`, and set `APPLE_TEAM_ID` to the
   10-character Apple Developer Team ID.
8. In App Store Connect, create an API key (Team key).
9. Add API key values:
   - `APPLE_API_KEY`: contents of the downloaded `.p8`
   - `APPLE_API_KEY_ID`: Key ID
   - `APPLE_API_ISSUER`: Issuer ID
10. Complete the Clerk Native API and AASA setup in [Piku Connect Clerk Setup](../internals/piku-connect.md#desktop-passkeys).
11. Re-run a nightly release and confirm macOS artifacts are signed/notarized and contain the expected
    `com.apple.developer.associated-domains` entitlement.

Notes:

- `APPLE_API_KEY` is stored as raw key text in secrets.
- The workflow writes it to a temporary `AuthKey_<id>.p8` file at runtime.
- The workflow decodes `MACOS_PROVISIONING_PROFILE`, validates it with `security cms`, and passes it
  to the desktop packager.

## 3) Ongoing release checklist

1. Ensure `main` is green in CI.
2. Bump the base app version as needed; nightlies derive from the next patch version.
3. Wait for the scheduled run, or dispatch the workflow manually.
4. Verify workflow steps:
   - preflight passes
   - all matrix builds pass
   - `publish_cli` publishes the exact release version before the release job
   - release job uploads expected files
5. Smoke test downloaded artifacts.

## 4) Troubleshooting

- macOS build unsigned when expected signed:
  - Check all Apple secrets plus `APPLE_TEAM_ID` are populated and non-empty.
  - Confirm the provisioning profile belongs to `APPLE_TEAM_ID.dev.pikucode.app` and includes
    Associated Domains.
- Build fails with signing error:
  - Retry with secrets removed to confirm unsigned path still works.
  - Re-check certificate/profile names and tenant/client credentials.
