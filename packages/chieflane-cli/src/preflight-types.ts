export type PreflightIssue = {
  kind: string;
  message: string;
};

export type PreflightMutation = {
  scope: "gateway-profile" | "workspace" | "repo";
  action: string;
  target: string;
  value?: string | number | boolean;
  sensitive?: boolean;
};

export type PreflightPlan = {
  ok: boolean;
  blockers: PreflightIssue[];
  warnings: PreflightIssue[];
  repoRoot: string;
  openclaw: {
    profile: string;
    contextKey: string;
    isolated: boolean;
    stateDir: {
      value: string;
      source: "env" | "inferred" | "status-json";
    };
    configPath: {
      value: string;
      source: "env" | "inferred" | "status-json";
    };
    workspace: {
      value: string;
      source: "arg" | "config" | "default" | "state";
    };
    gateway: {
      configuredPort: number | null;
      plannedPort: number;
      reservedRange: {
        start: number;
        end: number;
      };
      url: string;
      probe: {
        ok: boolean;
        multipleGateways: boolean;
        targets: Array<{
          url: string;
          ok: boolean;
        }>;
      };
    };
  };
  shell: {
    plannedPort: number;
    apiUrl: string;
    healthUrl: string;
  };
  packageManager: {
    pnpmAvailable: boolean;
    corepackAvailable: boolean;
    action: "none" | "enable-corepack" | "install-corepack" | "manual";
    pinnedSpec: string;
  };
  mutations: PreflightMutation[];
};
