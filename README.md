# Chieflane

Chieflane is a manifest-driven shell integration pack for OpenClaw. The repo now bootstraps itself into the active OpenClaw workspace instead of asking you to copy skills and workspace files by hand.

The intended install UX is:

```bash
pnpm bootstrap --mode live
pnpm verify --full
```

For demo screenshots and seeded placeholder surfaces:

```bash
pnpm bootstrap --mode demo
```

## Use With Codex Or Claude Code

If you want a full-permission coding agent to do the local setup for you, give it the canonical bootstrap flow instead of the old manual copy/link steps.

### Codex prompt

```text
Hi Codex.

Read README.md first, then set up Chieflane locally in this repo.

Assume you have full filesystem, terminal, browser, and network access.

Do this:

1. Detect whether `openclaw` is already installed and whether a local gateway is running.
2. If OpenClaw is missing, install it using the official docs and stop only if you need credentials or onboarding input from me.
3. Copy `.env.example` to `.env` if needed and tell me exactly which values still require my input.
4. Run `pnpm install`.
5. Run `pnpm bootstrap --mode live --workspace auto --merge safe --heartbeat skip`.
6. Run `pnpm verify --full`.
7. If verification fails, run `pnpm run doctor`, inspect the generated report, fix what you can, and retry.
8. Verify the shell in a browser and leave me with the local URLs, what is running, and any remaining blockers.
```

### Claude Code prompt

```text
Hi Claude.

Read README.md first, then set up Chieflane locally in this repo.

Assume you have full filesystem, terminal, browser, and network access.

Do this:

1. Reuse any existing local OpenClaw install if possible; otherwise install it and complete the minimum onboarding needed for a local gateway.
2. Create `.env` from `.env.example` if needed and tell me which secrets or credentials still require my input.
3. Run `pnpm install`.
4. Run `pnpm bootstrap --mode live --workspace auto --merge safe --heartbeat skip`.
5. Run `pnpm verify --full`.
6. If verification fails, run `pnpm run doctor`, use the report to debug, and keep going until the local setup is either working or clearly blocked on my input.
7. Check the shell in a browser and report the final local URLs, running commands, and next manual steps.
```

## Prerequisites

- Node.js 22+
- `pnpm` 10+
- An installed `openclaw` CLI with a working gateway
- Valid values for the shell and gateway env vars in `.env`

Copy the example env file first:

```bash
cp .env.example .env
```

Required env vars:

- `SHELL_API_URL`
- `SHELL_INTERNAL_API_KEY`
- `OPENCLAW_GATEWAY_URL`
- `OPENCLAW_GATEWAY_TOKEN`

Optional:

- `DATABASE_PATH`
- `SHELL_APP_PASSWORD`
- `SHELL_APP_SESSION_SECRET`
- `WEB_PUSH_VAPID_*`

## Flow A: Existing OpenClaw Workspace

Use this for a workspace that already has custom `AGENTS.md`, `TOOLS.md`, `HEARTBEAT.md`, or `MEMORY.md`.

```bash
pnpm install
pnpm bootstrap --mode live --workspace auto --merge safe --heartbeat skip
pnpm verify --full
```

What bootstrap does:

- Detects the active OpenClaw workspace from `agents.defaults.workspace`
- If `--workspace` is explicit, updates `agents.defaults.workspace` to that path before continuing
- Enables the OpenClaw `/v1/responses` endpoint
- Installs and enables the `surface-lane` plugin
- Writes the plugin config from env vars
- Installs Chieflane skills into `<workspace>/.agents/skills` and preserves existing customized skill folders in `--merge safe`
- Merges Chieflane blocks into `AGENTS.md` and `TOOLS.md`
- Leaves user-managed `HEARTBEAT.md` and `MEMORY.md` alone by default
- Upserts the starter cron jobs
- Initializes the shell database
- Writes `.chieflane/install-report.json` and `.chieflane/install-report.md`

## Flow B: Greenfield Workspace

Use this when you want Chieflane to provision the workspace templates too.

```bash
pnpm install
pnpm bootstrap --mode live --workspace ~/.openclaw/workspace --merge force --heartbeat manage
pnpm verify --full
```

This path creates the greenfield `AGENTS.md`, `TOOLS.md`, `HEARTBEAT.md`, and `MEMORY.md` templates under the target workspace when they are missing, sets that workspace as the active OpenClaw workspace, then configures the OpenClaw integration around it.

## Flow C: Demo Mode

Demo mode follows the live install path and also seeds fictional placeholder surfaces for local smoke testing.

```bash
pnpm install
pnpm bootstrap --mode demo
```

## Verification And Diagnostics

Run a full integration check:

```bash
pnpm verify --full
```

`verify --full` checks:

- `openclaw gateway status`
- `openclaw doctor`
- `/v1/responses` enabled
- `surface-lane` installed and enabled
- Chieflane skills present in the active workspace
- shell `GET /api/health`
- tool roundtrip via `/tools/invoke` for `surface_publish`, `surface_patch`, and `surface_close`

Collect diagnostics without changing anything:

```bash
pnpm run doctor
```

The doctor report is written to `<workspace>/.chieflane/doctor-report.json`.

`pnpm doctor` is a pnpm built-in command, so use `pnpm run doctor` or `pnpm diagnose` for the Chieflane diagnostics flow.

Preview bootstrap without writing:

```bash
pnpm bootstrap --mode live --dry-run
```

## What Bootstrap Never Overwrites By Default

- Existing `MEMORY.md`
- Existing user-managed `HEARTBEAT.md`
- Existing workspace instructions outside the managed Chieflane blocks

When bootstrap edits a workspace file, it writes a backup to:

```text
<workspace>/.chieflane/backups/
```

## Rollback

To roll back workspace changes, restore the backup files from:

```text
<workspace>/.chieflane/backups/
```

You can also inspect the machine-readable report in:

```text
<workspace>/.chieflane/install-report.json
```

## Local Shell-Only Smoke Test

If you want to validate the web shell without an OpenClaw gateway, you can still run the shell directly:

```bash
pnpm install
pnpm db:init
pnpm seed:demo
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Common Commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm typecheck
pnpm db:init
pnpm seed:demo
pnpm bootstrap --mode live
pnpm verify --full
pnpm run doctor
```

## Repository Layout

```text
apps/
  web/                              # Next.js shell
packages/
  chieflane-cli/                    # bootstrap / verify / doctor CLI
  openclaw-plugin-surface-lane/     # OpenClaw plugin package
  openclaw-skills-chief/            # workspace skill pack
  surface-schema/
  surface-catalog/
  surface-renderer-web/
  surface-renderer-native/
  shared/
openclaw/
  pack/
    workspace/
      greenfield/                   # full template files
      snippets/                     # mergeable managed blocks
    cron/
      jobs.json                     # desired cron job definitions
chieflane.integration.json          # machine-readable integration manifest
```
