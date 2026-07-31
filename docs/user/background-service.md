# Running Piku Code in the Background

On a Linux host, Piku Code can run as a background service for your user. It starts when the machine
boots and keeps running after you log out.

## Manage the Service

Install it with the newest Piku Code nightly release:

```sh
npx piku@nightly service install
```

Check whether it is installed:

```sh
npx piku@nightly service status
```

Update or repair it:

```sh
npx piku@nightly service update
```

Stop it and remove it from startup:

```sh
npx piku@nightly service uninstall
```

Updating restarts Piku Code briefly. Let active agent work and terminal commands finish first.

## Using It with Piku Connect

Piku Connect may offer to install the service during setup so the host stays reachable after you log
out. This is only an onboarding shortcut: the service and Piku Connect are managed separately.

Signing out of Piku Connect does not remove the service. Use `piku service uninstall` when you no longer
want Piku Code to start in the background.

The background service currently requires Linux with systemd.
