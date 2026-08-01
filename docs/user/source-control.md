# Source Control Integrations

Piku Code connects to GitHub so you can create pull requests, review code, and manage repositories without leaving the app.

## Supported Providers

- **GitHub** – Pull requests, repository creation, and clone integration
- **Any Git remote** – Clone from and push to any Git URL, with local Git operations fully supported

## What You Can Do

### Start Projects from Anywhere

**Clone repositories directly**

- Open the Command Palette (`Cmd/Ctrl + K`) → **Add Project**
- Choose a **local folder**, a **GitHub repository**, or paste any **Git URL**
- Enter the repository path (`owner/repo`) or a full Git URL, pick a destination, and start coding

**Publish local projects to the cloud**

- Have a local Git repository without a remote?
- Use the **Publish Repository** action to create a new GitHub repository, add it as your origin remote, and push, in one flow
- If the local repository has no commits yet, publishing creates the remote and wires it up but does not push. Make a commit, then push normally.

### Manage Code Reviews Without Context Switching

**Create pull requests while you work**

- Push a branch and create a pull request from the Git actions controls in the toolbar
- Piku Code can suggest titles and descriptions based on your commits

**Stay on top of open reviews**

- See if your current branch already has an open PR
- Open the review directly in your browser with one click
- Check out a teammate's branch to review code locally

### Know Your Setup at a Glance

The **Source Control settings** page shows you exactly what's connected:

- ✅ Whether GitHub is authenticated and ready
- ⚠️ What's missing and how to fix it
- 👤 Which account is signed in (when available)

Run a quick **Rescan** after setting up a new machine or changing credentials.

## Getting Started

1. Install the GitHub CLI on the machine running Piku Code:
   ```bash
   brew install gh
   ```
2. Sign in:
   ```bash
   gh auth login
   ```
3. Open **Settings → Source Control** in Piku Code and verify GitHub shows as authenticated

You can now clone, publish, and create pull requests.

---

## Requirements & Troubleshooting

**Git is required** – Piku Code uses Git for all local operations. Ensure `git` is installed on your server.

**Server-side setup** – Authentication happens on the machine running Piku Code (the server), not your local browser. If you're using a hosted or team instance, your administrator may have already configured GitHub.

**Common issues:**

- **GitHub shows "Not authenticated"** – Run `gh auth login` in a terminal on the server, then rescan in Settings
- **Can't push to a remote** – Verify your Git remote URL matches the account you've authenticated with (SSH vs HTTPS remotes may need different credentials)

**Need more help?** Check the [GitHub CLI documentation](https://cli.github.com/).
