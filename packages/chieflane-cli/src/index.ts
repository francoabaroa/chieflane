import { cac } from "cac";
import { runBootstrap } from "./bootstrap";
import { runDoctor } from "./doctor";
import { runPreflightCommand } from "./preflight";
import { runSetupLocal } from "./setup-local";
import { runSyncCron } from "./cron";
import { runPublishTestSurface } from "./publish-test-surface";
import {
  runShellStart,
  runShellStatus,
  runShellStop,
} from "./shell-commands";
import { runVerify } from "./verify";

const cli = cac("chieflane");

function commonOpenClawOptions<T extends ReturnType<typeof cli.command>>(cmd: T) {
  return cmd
    .option("--profile <name>", "OpenClaw profile name to target")
    .option("--dev", "Use OpenClaw --dev isolated state/profile", {
      default: false,
    });
}

commonOpenClawOptions(
  cli.command("preflight", "Resolve OpenClaw context, paths, ports, and planned mutations without writing")
)
  .option("--workspace <path>", "OpenClaw workspace path or auto", {
    default: "auto",
  })
  .option("--json", "Print machine-readable output", { default: true })
  .action(runPreflightCommand);

commonOpenClawOptions(
  cli.command("bootstrap", "Install Chieflane into the active OpenClaw workspace")
)
  .option("--mode <mode>", "live | demo", { default: "live" })
  .option("--workspace <path>", "OpenClaw workspace path or auto", {
    default: "auto",
  })
  .option("--merge <strategy>", "safe | force", { default: "safe" })
  .option("--heartbeat <mode>", "skip | manage | force", {
    default: "skip",
  })
  .option("--plugin-source <mode>", "path | npm | clawhub | link", {
    default: "path",
  })
  .option("--dry-run", "Preview changes without writing", { default: false })
  .option("--resume", "Resume from the last successful checkpoint", { default: false })
  .option("--from-step <id>", "Resume starting from a specific bootstrap step")
  .action(runBootstrap);

commonOpenClawOptions(
  cli.command("verify", "Verify Chieflane + OpenClaw integration")
)
  .option("--full", "Run end-to-end surface publish/patch verification", {
    default: false,
  })
  .option("--workspace <path>", "Workspace path, auto, or last bootstrapped", {
    default: "auto",
  })
  .option("--ensure-shell <mode>", "auto | never", { default: "auto" })
  .option("--agent-smoke <mode>", "off | warn | required", { default: "warn" })
  .action(runVerify);

commonOpenClawOptions(
  cli.command(
    "setup-local",
    "Local-first install: install deps, bootstrap, verify, and start the shell"
  )
)
  .option("--mode <mode>", "live | demo", { default: "live" })
  .option("--workspace <path>", "OpenClaw workspace path or auto", {
    default: "auto",
  })
  .option("--merge <strategy>", "safe | force", { default: "safe" })
  .option("--heartbeat <mode>", "skip | manage | force", {
    default: "skip",
  })
  .option("--plugin-source <mode>", "path | npm | clawhub | link", {
    default: "path",
  })
  .option("--keep-shell", "Leave a local shell process running", {
    default: true,
  })
  .option("--check", "Only print the plan; do not write anything", {
    default: false,
  })
  .option("--open", "Open the shell URL after a successful setup", {
    default: false,
  })
  .option("--browser-check", "Fetch the shell root and /api/health before finishing", {
    default: false,
  })
  .action(runSetupLocal);

commonOpenClawOptions(
  cli.command("shell-start", "Start a persistent local Chieflane shell")
).action(runShellStart);
commonOpenClawOptions(
  cli.command("shell-stop", "Stop the persistent local Chieflane shell")
).action(runShellStop);
commonOpenClawOptions(
  cli.command("shell-status", "Check the local shell process")
).action(runShellStatus);

commonOpenClawOptions(
  cli.command("doctor", "Collect diagnostics")
).action(runDoctor);

commonOpenClawOptions(
  cli.command("sync-cron", "Sync only Chieflane cron jobs")
).action(runSyncCron);

commonOpenClawOptions(
  cli.command(
    "publish-test-surface",
    "Publish a visible demo surface into Chieflane"
  )
)
  .option(
    "--lane <lane>",
    "today | inbox | meetings | drafts | people | research | ops",
    { default: "today" }
  )
  .option("--open", "Open the shell after publishing", { default: false })
  .action(runPublishTestSurface);

cli.help();
cli.parse(process.argv.filter((value) => value !== "--"));
