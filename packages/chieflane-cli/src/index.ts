import { cac } from "cac";
import { runBootstrap } from "./bootstrap";
import { runDoctor } from "./doctor";
import { runVerify } from "./verify";

const cli = cac("chieflane");

cli
  .command("bootstrap", "Install Chieflane into the active OpenClaw workspace")
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
  .action(runBootstrap);

cli
  .command("verify", "Verify Chieflane + OpenClaw integration")
  .option("--full", "Run end-to-end surface publish/patch verification", {
    default: false,
  })
  .option("--workspace <path>", "Workspace path, auto, or last bootstrapped", {
    default: "auto",
  })
  .action(runVerify);

cli.command("doctor", "Collect diagnostics").action(runDoctor);

cli.help();
cli.parse();
