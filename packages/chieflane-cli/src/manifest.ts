import fs from "fs-extra";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const envVarSchema = z.object({
  name: z.string().min(1),
  required: z.boolean(),
});

const configEntrySchema = z.object({
  path: z.string().min(1),
  value: z.union([z.string(), z.boolean(), z.number()]).optional(),
  fromEnv: z.string().min(1).optional(),
});

const pluginSchema = z.object({
  id: z.string().min(1),
  source: z.object({
    mode: z.enum(["local-path", "npm", "clawhub"]),
    path: z.string().min(1).optional(),
    packageName: z.string().min(1).optional(),
  }),
});

const skillSchema = z.object({
  slug: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
});

const workspaceSnippetSchema = z.object({
  target: z.string().min(1),
  source: z.string().min(1),
  strategy: z.enum(["managed-block", "managed-heartbeat"]),
  blockId: z.string().min(1).optional(),
  mode: z.string().min(1).optional(),
});

const cronJobSchema = z.object({
  name: z.string().min(1),
  cron: z.string().min(1),
  timezone: z.string().min(1),
  timeoutSeconds: z.number().int().positive(),
  message: z.string().min(1),
});
const cronPackSchema = z.object({
  jobs: z.array(cronJobSchema),
});

const healthCheckSchema = z.object({
  kind: z.string().min(1),
  id: z.string().min(1).optional(),
  tool: z.string().min(1).optional(),
  slugs: z.array(z.string().min(1)).optional(),
});

const integrationManifestSchema = z.object({
  $schema: z.string().min(1),
  id: z.string().min(1),
  version: z.string().min(1),
  env: z.array(envVarSchema),
  openclaw: z.object({
    config: z.array(configEntrySchema),
    plugin: pluginSchema,
    skills: z.array(skillSchema),
    workspace: z.object({
      greenfieldTemplates: z.record(z.string().min(1)),
      snippets: z.array(workspaceSnippetSchema),
    }),
    cron: z.array(cronJobSchema),
    healthChecks: z.array(healthCheckSchema),
  }),
  modes: z.object({
    demo: z.object({
      seedDemoData: z.boolean(),
    }),
    live: z.object({
      seedDemoData: z.boolean(),
    }),
  }),
});

export type IntegrationManifest = z.infer<typeof integrationManifestSchema>;
export type ManifestSnippet = z.infer<typeof workspaceSnippetSchema>;
export type ManifestCronJob = z.infer<typeof cronJobSchema>;

function exists(filePath: string) {
  return fs.pathExistsSync(filePath);
}

export function findRepoRoot(startDir = process.cwd()): string {
  let current = path.resolve(startDir);

  while (true) {
    const candidate = path.join(current, "chieflane.integration.json");
    if (exists(candidate)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  const fromModule = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../.."
  );
  const fallbackManifest = path.join(fromModule, "chieflane.integration.json");
  if (exists(fallbackManifest)) {
    return fromModule;
  }

  throw new Error("Unable to locate chieflane.integration.json from the current working directory.");
}

export function resolveRepoPath(
  repoRoot: string,
  relativePath: string
): string {
  return path.resolve(repoRoot, relativePath);
}

export async function loadManifest(repoRoot = findRepoRoot()) {
  const manifestPath = path.join(repoRoot, "chieflane.integration.json");
  const raw = await fs.readJson(manifestPath);
  const manifest = integrationManifestSchema.parse(raw);
  const cronPackPath = path.join(repoRoot, "openclaw/pack/cron/jobs.json");

  if (await fs.pathExists(cronPackPath)) {
    const cronPack = cronPackSchema.parse(await fs.readJson(cronPackPath));
    manifest.openclaw.cron = cronPack.jobs;
  }

  return manifest;
}

export function getRequiredEnvNames(manifest: IntegrationManifest) {
  return manifest.env.filter((entry) => entry.required).map((entry) => entry.name);
}
