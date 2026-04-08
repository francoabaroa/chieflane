# Hi, this is Chieflane.

Chieflane is an operator shell for OpenClaw. It is not a prettier chat window. OpenClaw stays the brain, scheduler, memory layer, and tool/runtime. Chieflane owns the UI state, review surfaces, actions, notifications, and persistent work lanes.

> Warning
>
> Chieflane is still experimental and should be treated as beta software. Expect rough edges, incomplete workflows, and bugs. Use it at your own peril, especially for anything you cannot easily recover.

This repo is MIT licensed. The seeded demo data is synthetic placeholder content for local evaluation only.

## Get started with Codex

The fastest way to get this running is with Codex or another full-permission code agent.

Once Codex is running, paste this:

```text
Hi Codex.

Clone git@github.com:francoabaroa/chieflane.git into my current directory and read README.md first.

I want Chieflane running locally, connected to a local OpenClaw gateway if possible.

Assume you have full filesystem, terminal, and network permissions on this machine.

Do this:

1. Detect whether OpenClaw is already installed locally by checking for the `openclaw` CLI, `~/.openclaw`, and any running local gateway.
2. If OpenClaw is missing, install it with the official installer and run the onboarding flow for a local gateway.
3. In this repo, run `pnpm install`, copy `.env.example` to `.env`, generate secure values for `SHELL_INTERNAL_API_KEY` and `SHELL_APP_SESSION_SECRET`, and keep `OPENCLAW_GATEWAY_URL` pointed at my local gateway.
4. Make sure OpenClaw has the OpenResponses HTTP endpoint enabled.
5. Link the local plugin from `packages/openclaw-plugin-surface-lane`, copy the Chieflane skill files into the active OpenClaw workspace skill directory, and copy the workspace starter files from `openclaw/workspace/` into the active OpenClaw workspace.
6. Seed the local Chieflane database, start the Chieflane web app, and verify it loads in a browser.
7. Tell me exactly when you need my model-provider credentials, push keys, or any other secrets.
8. Leave me with the local URLs, running commands, and the next manual steps.
```

## Get started with Claude Code

If you prefer Claude Code, use the same flow.

Paste this:

```text
Hi Claude.

Clone git@github.com:francoabaroa/chieflane.git into my current directory and read README.md first.

I want Chieflane running locally, connected to a local OpenClaw gateway if possible.

Assume you have full filesystem, terminal, and network permissions on this machine.

Do this:

1. Reuse any existing local OpenClaw install if it exists. Otherwise install OpenClaw locally and run onboarding.
2. Set up this repo with `pnpm install`, `.env` from `.env.example`, seeded demo data, and the web app running locally.
3. Enable the OpenClaw OpenResponses HTTP endpoint, then connect Chieflane to the local gateway.
4. Install the local `openclaw-plugin-surface-lane` plugin, copy the Chieflane skills into the active OpenClaw workspace, and copy the workspace starter files into place.
5. Stop only when the shell is loading locally and you can tell me what still needs my credentials or approval.
```

## Manual setup

If you want to do it yourself, here is the exact flow.

### Prerequisites

- Node.js 24 recommended. Node 22.14+ also works. Chieflane alone works on Node 18+, but OpenClaw currently recommends newer Node.
- `pnpm` 10+
- Git
- `openssl` or another way to generate random secrets
- An API key for whatever model provider you plan to use with OpenClaw

### 1. Clone and install Chieflane

```bash
git clone git@github.com:francoabaroa/chieflane.git
cd chieflane
pnpm install
cp .env.example .env
```

Generate local secrets and paste them into `.env`:

```bash
openssl rand -hex 24   # use for SHELL_INTERNAL_API_KEY
openssl rand -hex 32   # use for SHELL_APP_SESSION_SECRET
```

`SHELL_APP_PASSWORD` is optional. Leave it blank if you do not want a password gate on the shell UI.

### 2. Run Chieflane in local demo mode

```bash
pnpm seed
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

At this point the shell works with seeded demo surfaces even before OpenClaw is connected.

### Common development commands

Run these from the repo root:

```bash
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm typecheck
pnpm seed
```

`pnpm lint`, `pnpm test`, and `pnpm typecheck` are the main local quality checks before opening a PR.

### 3. Install or detect OpenClaw locally

If you already have OpenClaw installed, check it first:

```bash
openclaw gateway status || true
openclaw dashboard
```

If OpenClaw is not installed yet, the recommended path is the official installer:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
openclaw onboard --install-daemon
openclaw gateway status
```

Useful references:

- [OpenClaw install docs](https://docs.openclaw.ai/install)
- [OpenClaw getting started](https://docs.openclaw.ai/start/getting-started)
- [OpenClaw gateway docs](https://docs.openclaw.ai/cli/gateway)

The local Gateway normally listens on `http://127.0.0.1:18789` for the OpenResponses HTTP endpoint and `ws://127.0.0.1:18789` for Gateway RPC.

### 4. Enable the OpenResponses HTTP endpoint

Chieflane calls `POST /v1/responses`, which is disabled by default in OpenClaw.

Enable this in your OpenClaw config:

```json
{
  "gateway": {
    "http": {
      "endpoints": {
        "responses": {
          "enabled": true
        }
      }
    }
  }
}
```

If you are using the default profile, this config lives in `~/.openclaw/openclaw.json`.

Make sure `OPENCLAW_GATEWAY_TOKEN` in Chieflane `.env` matches the token or password you configured during OpenClaw onboarding.

After changing config, restart the Gateway if needed:

```bash
openclaw gateway restart
```

### 5. Install the local Chieflane plugin into OpenClaw

From the Chieflane repo root:

```bash
openclaw plugins install --link ./packages/openclaw-plugin-surface-lane
openclaw gateway restart
openclaw plugins list
```

OpenClaw supports linking a plugin directly from a local folder, so you can iterate on this repo without publishing the plugin first.

### 6. Copy the Chieflane skills and workspace pack

By default OpenClaw loads project-local skills from `<workspace>/.agents/skills`, and the default workspace is `~/.openclaw/workspace`.

Create the skill directories:

```bash
mkdir -p ~/.openclaw/workspace/.agents/skills/chief-shell
mkdir -p ~/.openclaw/workspace/.agents/skills/morning-ops
mkdir -p ~/.openclaw/workspace/.agents/skills/meeting-ops
mkdir -p ~/.openclaw/workspace/.agents/skills/relationship-context
```

Copy the skill files:

```bash
cp packages/openclaw-skills-chief/chief-shell.md ~/.openclaw/workspace/.agents/skills/chief-shell/SKILL.md
cp packages/openclaw-skills-chief/morning-ops.md ~/.openclaw/workspace/.agents/skills/morning-ops/SKILL.md
cp packages/openclaw-skills-chief/meeting-ops.md ~/.openclaw/workspace/.agents/skills/meeting-ops/SKILL.md
cp packages/openclaw-skills-chief/relationship-context.md ~/.openclaw/workspace/.agents/skills/relationship-context/SKILL.md
```

Copy the workspace starter files:

```bash
cp openclaw/workspace/AGENTS.md ~/.openclaw/workspace/AGENTS.md
cp openclaw/workspace/HEARTBEAT.md ~/.openclaw/workspace/HEARTBEAT.md
cp openclaw/workspace/TOOLS.md ~/.openclaw/workspace/TOOLS.md
cp openclaw/workspace/MEMORY.md ~/.openclaw/workspace/MEMORY.md
cp openclaw/workspace/standing-orders.md ~/.openclaw/workspace/standing-orders.md
```

If you want to keep an existing OpenClaw workspace, merge these files manually instead of overwriting them.

### 7. Wire Chieflane back into OpenClaw

Make sure your Chieflane `.env` contains values like this:

```bash
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=<your-openclaw-token>
SHELL_API_URL=http://localhost:3000
SHELL_INTERNAL_API_KEY=<your-generated-shell-api-key>
```

These values let:

- Chieflane call OpenClaw at `/v1/responses`
- the OpenClaw plugin call back into Chieflane at `/api/internal/surfaces/*`

### 8. Optional: configure the starter cron jobs

This repo ships starter schedules in [openclaw/cron/jobs.template.json](./openclaw/cron/jobs.template.json).

Example:

```bash
openclaw cron add \
  --name morning-ops \
  --cron "0 9 * * 1-5" \
  --tz America/New_York \
  --timeout-seconds 300 \
  --message "Execute Morning Ops per standing orders. Update the morning brief and today-board surfaces. Send fallback text only if action is needed."
```

Repeat that pattern for the other jobs in `openclaw/cron/jobs.template.json`.

### 9. Verify everything

In one terminal:

```bash
pnpm dev
```

In another:

```bash
openclaw gateway status --require-rpc || openclaw gateway
```

Then run:

```bash
pnpm lint
pnpm test
pnpm typecheck
```

If the shell loads at [http://localhost:3000](http://localhost:3000) and OpenClaw is reachable at [http://127.0.0.1:18789](http://127.0.0.1:18789), the local integration is ready.

## Architecture

```text
Capture lane (Telegram / WhatsApp / Slack / voice)
                    │
                    ▼
              OpenClaw Gateway
   (channels, skills, memory, cron, Task Flow, tools)
                    │
        surface_publish / patch / close tools
                    │
                    ▼
          Chieflane Shell Backend (Next.js)
    - surface store (SQLite)
    - action registry
    - SSE + push notifications
    - calls OpenClaw /v1/responses
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
      Web PWA             Native app later
      (primary)            (phase 2)
```

## Project structure

```text
apps/
  web/                              # Next.js PWA shell
  native/                           # Native scaffold for phase 2
packages/
  surface-schema/                   # Zod contract for persistent surfaces
  surface-catalog/                  # json-render catalog for dynamic blocks
  surface-renderer-web/             # Web registry for json-render blocks
  surface-renderer-native/          # Native registry scaffold
  design-system/                    # Tokens and shared UI primitives
  shared/                           # Shared formatting and validation helpers
  openclaw-plugin-surface-lane/     # Local OpenClaw plugin
  openclaw-skills-chief/            # Local OpenClaw skill pack
openclaw/
  workspace/                        # Starter AGENTS / HEARTBEAT / MEMORY files
  cron/                             # Starter cron definitions
```

## Contributing

PRs are welcome.

If you are using a code agent, point it at this README first. The repo is set up so an agent can bootstrap the shell, link the plugin locally, and wire in the OpenClaw workspace pack without publishing anything first.
