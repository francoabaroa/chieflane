import { findRepoRoot } from "./manifest";
import {
  getPersistentLocalShellStatus,
  startPersistentLocalShell,
  stopPersistentLocalShell,
} from "./local-shell";
import {
  getOpenClawContextKey,
  getOpenClawProfileLabel,
  primeOpenClawInvocationContext,
} from "./openclaw";
import { resolveRuntimeEnv } from "./runtime-env";

type ShellCommandOptions = {
  profile?: string;
  dev?: boolean;
};

export async function runShellStart(options: ShellCommandOptions = {}) {
  const repoRoot = findRepoRoot();
  const context = primeOpenClawInvocationContext({
    repoRoot,
    profile: options.profile,
    dev: options.dev === true,
  });
  const runtimeEnv = await resolveRuntimeEnv({
    repoRoot,
    allowGenerateGatewayToken: false,
    allowGenerateShellInternalApiKey: false,
    persistGeneratedValues: true,
    profile: context.profile,
    dev: context.dev,
  });
  const openclawProfile = getOpenClawProfileLabel(context);
  const openclawContextKey = getOpenClawContextKey(context);
  const shell = await startPersistentLocalShell({
    repoRoot,
    runtimeEnv,
    openclawProfile: openclawContextKey,
  });
  console.log(
    JSON.stringify(
      {
        ...shell,
        openclawProfile,
      },
      null,
      2
    )
  );
}

export async function runShellStop(options: ShellCommandOptions = {}) {
  const repoRoot = findRepoRoot();
  const context = primeOpenClawInvocationContext({
    repoRoot,
    profile: options.profile,
    dev: options.dev === true,
  });
  const openclawProfile = getOpenClawProfileLabel(context);
  const openclawContextKey = getOpenClawContextKey(context);
  const result = await stopPersistentLocalShell(repoRoot, openclawContextKey);
  console.log(
    JSON.stringify(
      {
        ...result,
        openclawProfile,
      },
      null,
      2
    )
  );
}

export async function runShellStatus(options: ShellCommandOptions = {}) {
  const repoRoot = findRepoRoot();
  const context = primeOpenClawInvocationContext({
    repoRoot,
    profile: options.profile,
    dev: options.dev === true,
  });
  const openclawProfile = getOpenClawProfileLabel(context);
  const openclawContextKey = getOpenClawContextKey(context);
  const result = await getPersistentLocalShellStatus(repoRoot, openclawContextKey);
  console.log(
    JSON.stringify(
      {
        ...result,
        openclawProfile,
      },
      null,
      2
    )
  );
}
