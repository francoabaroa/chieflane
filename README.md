# Chieflane

Chieflane is a manifest-driven shell integration pack for OpenClaw. It installs the `surface-lane` plugin, provisions the Chieflane skill pack into the active workspace, merges the workspace snippets, verifies the integration end to end, and runs the local shell.

## Fastest Zero-Assumption Local Setup

```bash
node ./scripts/setup-local.mjs --check --dev
node ./scripts/setup-local.mjs --dev --open
```

If you already have `pnpm`:

```bash
pnpm setup-local -- --dev --open
```

`setup-local --check` is a no-write preview. If `pnpm` or repo dependencies are not installed yet, the wrapper exits and tells you what to install instead of bootstrapping them for you.

This flow:

- bootstraps `pnpm` via Corepack when needed for setup runs
- installs repo dependencies if needed for setup runs
- discovers the active OpenClaw profile and workspace
- prints the full OpenClaw context, paths, ports, and planned mutations with `--check`
- auto-plans an isolated gateway base port for `--dev` and named profiles
- repairs an incomplete existing `surface-lane` plugin config before validated OpenClaw commands run
- bootstraps the plugin, tool policy, workspace snippets, skills, cron jobs, and Chieflane agent contract
- verifies the integration end to end and writes a dedicated verify report
- starts a local shell and prints the final URLs plus config/state/report paths

### Important Scope Note

Chieflane modifies the active OpenClaw profile, not only the target workspace.

Bootstrap will:

- enable `/v1/responses`
- install and enable the `surface-lane` plugin
- write plugin config
- merge the managed Chieflane `AGENTS.md` / `TOOLS.md` contract blocks
- install the Chieflane workspace skills
- sync Chieflane cron jobs
- restart the gateway

A disposable workspace path does not isolate those changes.
OpenClaw profile changes affect config and state, not just the workspace.

For the safest isolated default, use `--dev`:

```bash
node ./scripts/setup-local.mjs --check --dev
node ./scripts/setup-local.mjs --dev --open
```

For a persistent named profile:

```bash
node ./scripts/setup-local.mjs --check --profile chieflane
node ./scripts/setup-local.mjs --profile chieflane --open
```

Chieflane auto-plans a unique `gateway.port` for isolated named profiles when needed.

## Use With Codex Or Claude Code

If you want a coding agent to do the local setup for you, give it the current local-first flow instead of the older manual env/bootstrap steps.

### Codex Prompt

```text
Hi Codex.

Clone https://github.com/francoabaroa/chieflane into my current directory.

Then read README.md first. I want to get Chieflane running locally on my Mac.

Assume you have full filesystem, terminal, browser, and network access.

Use the safer isolated profile flow by default:

node ./scripts/setup-local.mjs --dev --open

Do this:

1. Check whether Node.js and the openclaw CLI are already installed.
2. If OpenClaw is missing, install it using the official docs and stop only if you need credentials, login, or onboarding input from me.
3. Run `node ./scripts/setup-local.mjs --check --dev` first and show me the exact planned mutations.
4. Run `node ./scripts/setup-local.mjs --dev --open --browser-check`.
5. If setup fails, run `pnpm verify --full` and `pnpm run doctor`, inspect the generated reports, fix what you can, and retry.
6. Use the browser to confirm the shell is actually up and healthy.
7. Leave me with the final local URLs, the OpenClaw profile/workspace you touched, what is still running, and any blockers or manual follow-up.
```

### Claude Code Prompt

```text
Hi Claude.

Clone https://github.com/francoabaroa/chieflane into my current directory.

Then read README.md first. I want to get Chieflane running locally on my Mac.

Assume you have full filesystem, terminal, browser, and network access.

Use the safer isolated profile flow by default:

node ./scripts/setup-local.mjs --dev --open

Do this:

1. Reuse any existing local OpenClaw install if possible; otherwise install it and complete the minimum onboarding needed for a local gateway.
2. Run `node ./scripts/setup-local.mjs --check --dev` first, then `node ./scripts/setup-local.mjs --dev --open --browser-check`.
3. If setup fails, run pnpm verify --full and pnpm run doctor, use the reports to debug, and keep going until the local setup is working or clearly blocked on my input.
4. Open the shell in a browser, confirm the health endpoint works, and report the final URLs, running processes, and next manual steps.
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

### Publish A Visible Test Surface

After setup succeeds, empty lanes are normal until an agent, cron job, or manual test publishes a surface. To publish a visible demo card:

```bash
pnpm publish-test-surface -- --dev --open
```

Use the same `--profile <name>` or `--dev` flag that you used for setup. The shell also shows a first-run empty state with a `Publish test surface` button when setup is healthy and no non-verification surfaces have been published yet.

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
- `openclaw config validate`
- OpenClaw health
- `/v1/responses` enabled
- `surface-lane` installed and enabled
- Chieflane skills present in `skills/` or `.agents/skills/`
- shell `GET /api/health`
- tool roundtrip via `/tools/invoke` for `surface_publish`, `surface_patch`, and `surface_close`

By default, `verify` also runs an optional real-agent smoke test in warning mode. Use:

```bash
pnpm verify -- --full --agent-smoke off
pnpm verify -- --full --agent-smoke required
```

Collect diagnostics without changing anything:

```bash
pnpm run doctor
```

Preview bootstrap without writing:

```bash
pnpm bootstrap --mode live --dry-run
```

Resolve the full OpenClaw plan without writing:

```bash
pnpm preflight -- --profile chieflane
```

The install report is written to:

```text
<workspace>/.chieflane/install-report.json
<workspace>/.chieflane/install-report.md
```

The verify report is written to:

```text
<workspace>/.chieflane/verify-report.json
<workspace>/.chieflane/verify-report.md
```

The doctor report is written to:

```text
<workspace>/.chieflane/doctor-report.json
```

Bootstrap also writes:

```text
<workspace>/.chieflane/bootstrap-checkpoint.json
<workspace>/.chieflane/current-status.json
.chieflane/current-status.json
```

The repo-local `.chieflane/current-status.json` is a generated local status pointer for the debug setup-status endpoint and is ignored by git.

`setup-local --check` prints:

- OpenClaw profile label
- OpenClaw state dir
- OpenClaw config path
- workspace path
- planned gateway base port and reserved range
- shell URL and health URL
- exact planned mutations

If `openclaw` is missing, install it with:

- macOS/Linux/WSL: `curl -fsSL https://openclaw.ai/install.sh | bash`
- Windows PowerShell: `iwr -useb https://openclaw.ai/install.ps1 | iex`

### Partial Bootstrap Recovery

Plain `pnpm bootstrap` reruns all bootstrap steps so repo updates to skills, snippets, plugin code, and cron jobs are applied. If a previous run failed partway through and you intentionally want to resume from the checkpoint, use:

```bash
pnpm bootstrap -- --resume
pnpm bootstrap -- --from-step cron-sync
```

To retry only Chieflane cron jobs:

```bash
pnpm sync-cron -- --dev
pnpm sync-cron -- --profile chieflane
```

## Local Shell Commands

```bash
pnpm shell:start
pnpm shell:status
pnpm shell:stop
```

`setup-local` uses the same persistent shell flow and records the state in `.chieflane/runtime/`.

## Prerequisites

- Node.js 22+
- `pnpm` 10+ or a Node install with `npm`/Corepack available
- an installed `openclaw` CLI with a reachable gateway

`.env.example` is now optional-overrides-first. Most local installs should not require manual edits before `node ./scripts/setup-local.mjs`.

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
node ./scripts/setup-local.mjs --dev --open
pnpm setup-local -- --dev --open
pnpm preflight -- --dev
pnpm bootstrap --mode live
pnpm verify --full
pnpm sync-cron -- --dev
pnpm publish-test-surface -- --dev --open
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
