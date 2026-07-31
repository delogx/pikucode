# Piku Code

Piku Code is an "agent harness control surface". It enables control of the agents on your machine with a best-in-class [web app](https://app.pikucode.dev) and [Electron-based desktop app](https://pikucode.dev).

Works with your subscriptions on Claude Code and Codex. If they're set up on your computer, Piku Code can control them.

## "Wait, what are you selling me?"

Nothing. We built Piku Code because we wanted the best possible development experience with agents. We were inspired by existing solutions like the Codex desktop app, Conductor, Claude Desktop and Cursor Glass, but none met our bar.

We wanted something performant, remote-ready, and truly open. If we ever go the wrong direction, we want you to have everything you need to fork and build the editor that you want.

## Installation

> [!WARNING]
> Piku Code currently supports Codex and Claude. Install and authenticate at least one provider before use:
>
> - Codex: install [Codex CLI](https://developers.openai.com/codex/cli) and run `codex login`
> - Claude: install [Claude Code](https://claude.com/product/claude-code) and run `claude auth login`

### Try it out (install-free)

The easiest way to test Piku Code is to run the server in your terminal (requires Node.js 22.16+, 23.11+, or 24.10+):

```bash
npx piku@latest
```

This will launch Piku Code's backend on your machine as well as the local web app to control your agents.

Tip: Use `npx piku@latest --help` for the full CLI reference.

### Desktop app

Install the latest version of the desktop app from [GitHub Releases](https://github.com/pingdotgg/pikucode/releases), or from your favorite package registry:

#### macOS (Homebrew)

```bash
brew install --cask piku-code
```

#### Arch Linux (AUR)

```bash
yay -S pikucode-bin
```

## Some notes

We are very very early in this project. Expect bugs.

We are (mostly) not accepting contributions yet. Small fixes may be considered. Big features will not be.

## Documentation

Full docs live in [docs/](./docs). There's no docs site yet.

- [Install and first run](./docs/user/install.md)
- [Permission modes](./docs/user/permission-modes.md)
- [Keyboard shortcuts](./docs/user/keybindings.md)
- [Remote access from a phone or another machine](./docs/user/remote-access.md)
- [Keeping app and server in sync](./docs/user/updating.md)
- [Source control integrations](./docs/user/source-control.md)
- Multiple accounts: [Codex](./docs/user/providers-codex.md) · [Claude](./docs/user/providers-claude.md)
- Linux: [run Piku Code as a background service](./docs/user/background-service.md)

Building from source? Start at [docs/internals/overview.md](./docs/internals/overview.md).

## If you REALLY want to contribute still.... read this first

### Install `vp`

Piku Code uses Vite+ so you'll need to install the global `vp` command-line tool.

```bash
curl -fsSL https://vite.plus | bash
```

Checkout their getting started guide for more information: https://viteplus.dev/guide/

### Install dependencies

```bash
vp i
```

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening an issue or PR.

Need support? Join the [Discord](https://discord.gg/jn4EGJjrvv).
