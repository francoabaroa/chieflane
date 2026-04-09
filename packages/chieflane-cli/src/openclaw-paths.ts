import type { OpenClawInvocationContext } from "./openclaw";
import { expandHome } from "./openclaw";

type PathSource = "env" | "inferred" | "status-json";

function visitStatusJson(
  value: unknown,
  keys: Set<string>
): string | null {
  if (typeof value === "string") {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = visitStatusJson(item, keys);
      if (found != null) {
        return found;
      }
    }
    return null;
  }

  if (value == null || typeof value !== "object") {
    return null;
  }

  for (const [key, child] of Object.entries(value)) {
    if (keys.has(key) && typeof child === "string" && child.trim()) {
      return child.trim();
    }
    const found = visitStatusJson(child, keys);
    if (found != null) {
      return found;
    }
  }

  return null;
}

function inferStateDir(context: OpenClawInvocationContext) {
  if (context.dev) {
    return expandHome("~/.openclaw-dev");
  }

  if (context.profile && context.profile !== "default") {
    return expandHome(`~/.openclaw-${context.profile}`);
  }

  return expandHome("~/.openclaw");
}

export function resolveOpenClawPaths(args: {
  context: OpenClawInvocationContext;
  workspace: string;
  env?: NodeJS.ProcessEnv;
  statusJson?: unknown;
}) {
  const env = args.env ?? process.env;
  const statusStateDir = visitStatusJson(
    args.statusJson,
    new Set(["stateDir", "stateDirectory", "stateRoot"])
  );
  const statusConfigPath = visitStatusJson(
    args.statusJson,
    new Set(["configPath", "configFile"])
  );

  const stateDir = env.OPENCLAW_STATE_DIR
    ? {
        value: expandHome(env.OPENCLAW_STATE_DIR),
        source: "env" as PathSource,
      }
    : statusStateDir
      ? {
          value: expandHome(statusStateDir),
          source: "status-json" as PathSource,
        }
      : {
          value: inferStateDir(args.context),
          source: "inferred" as PathSource,
        };

  const configPath = env.OPENCLAW_CONFIG_PATH
    ? {
        value: expandHome(env.OPENCLAW_CONFIG_PATH),
        source: "env" as PathSource,
      }
    : statusConfigPath
      ? {
          value: expandHome(statusConfigPath),
          source: "status-json" as PathSource,
        }
      : {
          value: expandHome(`${stateDir.value}/openclaw.json`),
          source: "inferred" as PathSource,
        };

  return {
    stateDir,
    configPath,
    workspace: args.workspace,
  };
}
