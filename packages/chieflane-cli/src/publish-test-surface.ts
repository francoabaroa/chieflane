import { openBrowser } from "./browser";
import { buildPublishTestSurfaceInput } from "@chieflane/surface-schema/demo-surface";
import {
  isLocalShellUrl,
  isShellHealthy,
  startPersistentLocalShell,
} from "./local-shell";
import { findRepoRoot } from "./manifest";
import {
  getOpenClawContextKey,
  isIsolatedOpenClawContext,
  primeOpenClawInvocationContext,
} from "./openclaw";
import { ensureRecoveredSurfaceLaneConfig } from "./plugin-config-recovery";
import { resolveRuntimeEnv } from "./runtime-env";
import { invokeGatewayTool } from "./gateway-client";

export async function runPublishTestSurface(options: {
  lane?: string;
  open?: boolean;
  profile?: string;
  dev?: boolean;
}) {
  const repoRoot = findRepoRoot();
  const context = primeOpenClawInvocationContext({
    repoRoot,
    profile: options.profile,
    dev: options.dev === true,
  });

  await ensureRecoveredSurfaceLaneConfig({
    repoRoot,
    context,
  });

  const runtimeEnv = await resolveRuntimeEnv({
    repoRoot,
    allowGenerateGatewayToken: isIsolatedOpenClawContext(context),
    allowGenerateShellInternalApiKey: true,
    persistGeneratedValues: true,
    profile: context.profile,
    dev: context.dev,
  });

  const publishArgs = buildPublishTestSurfaceInput(options.lane ?? "today");
  await invokeGatewayTool(
    runtimeEnv.gatewayUrl,
    runtimeEnv.gatewayToken,
    "surface_publish",
    publishArgs
  );

  if (options.open === true) {
    const openShell = async () => {
      const opened = await openBrowser(runtimeEnv.shellApiUrl);
      if (!opened) {
        throw new Error(`Failed to open a browser for ${runtimeEnv.shellApiUrl}.`);
      }
    };

    if (
      isLocalShellUrl(runtimeEnv.shellApiUrl) &&
      !(await isShellHealthy(runtimeEnv.shellApiUrl))
    ) {
      await startPersistentLocalShell({
        repoRoot,
        runtimeEnv,
        openclawProfile: getOpenClawContextKey(context),
      });
      await openShell();
    } else {
      await openShell();
    }
  }

  console.log(`Published test surface: ${publishArgs.surfaceKey}`);
  console.log(`Shell: ${runtimeEnv.shellApiUrl}`);

  return {
    surfaceKey: publishArgs.surfaceKey,
    shellApiUrl: runtimeEnv.shellApiUrl,
  };
}
