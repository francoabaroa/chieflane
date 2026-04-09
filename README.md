# Chieflane

Chieflane is a manifest-driven shell integration pack for OpenClaw. It installs the `surface-lane` plugin, provisions the Chieflane skill pack into the active workspace, merges the workspace snippets, verifies the integration end to end, and runs the local shell.

## Fastest Local Install

```bash
pnpm setup-local
```

This command:

- installs repo dependencies if needed
- discovers the active OpenClaw profile and workspace
- derives or reuses local gateway settings when possible
- bootstraps Chieflane
- verifies the integration end to end
- starts a local shell and prints the final URLs

### Important Scope Note

Chieflane modifies the active OpenClaw profile, not only the target workspace.

Bootstrap will:

- enable `/v1/responses`
- install and enable the `surface-lane` plugin
- write plugin config
- restart the gateway

A disposable workspace path does not isolate those changes.

For isolation, use a dedicated OpenClaw profile:

```bash
pnpm setup-local -- --profile chieflane
# or
pnpm setup-local -- --dev
```

## Manual And Advanced Paths

### Existing Customized Workspace

```bash
pnpm install
pnpm bootstrap --mode live --workspace auto --merge safe --heartbeat skip
pnpm verify --full
```

### Greenfield Workspace

```bash
pnpm install
pnpm bootstrap --mode live --workspace ~/.openclaw/workspace --merge force --heartbeat manage
pnpm verify --full
```

### Demo Mode

```bash
pnpm install
pnpm bootstrap --mode demo
```

`verify --full` auto-starts a temporary local shell only when `SHELL_API_URL` resolves to a local host and the shell is not already running. Remote shells are never auto-started.

## Local Env Behavior

For local token-auth gateways, Chieflane can usually derive:

- `OPENCLAW_GATEWAY_URL`
- `OPENCLAW_GATEWAY_TOKEN`
- `SHELL_API_URL`
- `SHELL_INTERNAL_API_KEY`

Shell overrides are still supported through `.env` and `.env.local`.
Gateway overrides should be exported in the current shell when you intentionally want to bypass OpenClaw profile discovery.

Chieflane will not silently rotate a gateway token on a shared/default OpenClaw profile. If no plaintext token is discoverable, rerun with `--profile <name>` or `--dev`, or set `OPENCLAW_GATEWAY_TOKEN` explicitly.

## Verification And Diagnostics

Run a full integration check:

```bash
pnpm verify --full
```

`verify --full` checks:

- runtime env resolution sources
- `openclaw gateway status`
- `openclaw doctor`
- `/v1/responses` enabled
- `surface-lane` installed and enabled
- Chieflane skills present in `skills/` or `.agents/skills/`
- shell `GET /api/health`
- tool roundtrip via `/tools/invoke` for `surface_publish`, `surface_patch`, and `surface_close`

Collect diagnostics without changing anything:

```bash
pnpm run doctor
```

Preview bootstrap without writing:

```bash
pnpm bootstrap --mode live --dry-run
```

The install report is written to:

```text
<workspace>/.chieflane/install-report.json
<workspace>/.chieflane/install-report.md
```

The doctor report is written to:

```text
<workspace>/.chieflane/doctor-report.json
```

## Local Shell Commands

```bash
pnpm shell:start
pnpm shell:status
pnpm shell:stop
```

`pnpm setup-local` uses the same persistent shell flow and records the state in `.chieflane/runtime/`.

## Prerequisites

- Node.js 22+
- `pnpm` 10+
- an installed `openclaw` CLI with a reachable gateway

`.env.example` is now optional-overrides-first. Most local installs should not require manual edits before `pnpm setup-local`.

## What Bootstrap Leaves Alone By Default

- existing `MEMORY.md`
- existing user-managed `HEARTBEAT.md`
- existing workspace instructions outside the managed Chieflane blocks
- existing customized skills when `--merge safe` is used

When bootstrap edits a workspace file, it writes a backup to:

```text
<workspace>/.chieflane/backups/
```

## Local Shell-Only Smoke Test

If you want to validate only the shell without touching OpenClaw:

```bash
pnpm install
pnpm db:init
pnpm seed:demo
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Common Commands

```bash
pnpm setup-local
pnpm bootstrap --mode live
pnpm verify --full
pnpm run doctor
pnpm shell:start
pnpm shell:status
pnpm shell:stop
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm typecheck
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
      greenfield/
      snippets/
    cron/
      jobs.json
chieflane.integration.json
```
