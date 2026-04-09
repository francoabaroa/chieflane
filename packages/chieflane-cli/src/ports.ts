import net from "node:net";

export const BASE_PORT_STEP = 20;
export const DEFAULT_GATEWAY_PORT = 18789;
export const DEV_GATEWAY_PORT = 19001;
export const NAMED_PROFILE_START = 19021;
export const NAMED_PROFILE_END = 19981;

export function reserveRange(port: number) {
  return {
    start: port,
    end: port + BASE_PORT_STEP - 1,
  };
}

export function rangesOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number }
) {
  return a.start <= b.end && b.start <= a.end;
}

export async function canBindLoopback(port: number): Promise<boolean> {
  return await new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve(true));
    });
  });
}

function stableHash(text: string) {
  let hash = 2166136261;
  for (const ch of text) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

export function preferredPortForProfile(profile: string) {
  const slots =
    Math.floor((NAMED_PROFILE_END - NAMED_PROFILE_START) / BASE_PORT_STEP) + 1;
  const offset = stableHash(profile) % slots;
  return NAMED_PROFILE_START + offset * BASE_PORT_STEP;
}

function isIsolatedContext(context: { dev?: boolean; profile?: string }) {
  return (
    context.dev === true ||
    (context.profile != null && context.profile !== "default")
  );
}

export async function chooseGatewayPort(args: {
  context: { dev?: boolean; profile?: string };
  configuredPort: number | null;
  occupiedBasePorts: number[];
  canBind?: (port: number) => Promise<boolean>;
}) {
  if (!isIsolatedContext(args.context)) {
    const port = args.configuredPort ?? DEFAULT_GATEWAY_PORT;
    return {
      port,
      reservedRange: reserveRange(port),
      shouldWrite: false,
    };
  }

  const occupiedRanges = args.occupiedBasePorts.map(reserveRange);
  const preferred = args.context.dev
    ? DEV_GATEWAY_PORT
    : args.context.profile
      ? preferredPortForProfile(args.context.profile)
      : args.configuredPort ?? DEFAULT_GATEWAY_PORT;

  const candidates: number[] = [];

  if (args.configuredPort != null && args.configuredPort !== DEFAULT_GATEWAY_PORT) {
    candidates.push(args.configuredPort);
  }
  candidates.push(preferred);

  for (let port = NAMED_PROFILE_START; port <= NAMED_PROFILE_END; port += BASE_PORT_STEP) {
    candidates.push(port);
  }

  const canBind = args.canBind ?? canBindLoopback;
  const seen = new Set<number>();

  for (const candidate of candidates) {
    if (seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);

    const candidateRange = reserveRange(candidate);
    if (occupiedRanges.some((range) => rangesOverlap(range, candidateRange))) {
      continue;
    }

    if (!(await canBind(candidate))) {
      continue;
    }

    return {
      port: candidate,
      reservedRange: candidateRange,
      shouldWrite: args.configuredPort !== candidate,
    };
  }

  throw new Error("Could not find a free isolated gateway base port.");
}
