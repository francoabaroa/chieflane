import type { StoredSurface } from "@chieflane/surface-schema";
import { fanoutEvent } from "@/lib/realtime";

export interface OpenClawResponse {
  id: string;
  output: Array<{
    type: string;
    text?: string;
    content?: unknown;
  }>;
}

function extractText(payload: Record<string, unknown>): string {
  const directText = payload.text;
  if (typeof directText === "string") {
    return directText;
  }

  const delta = payload.delta;
  if (typeof delta === "string") {
    return delta;
  }

  const outputText = payload.output_text;
  if (typeof outputText === "string") {
    return outputText;
  }

  const content = payload.content;
  if (Array.isArray(content)) {
    return content
      .map((item) =>
        typeof item === "object" &&
        item !== null &&
        "text" in item &&
        typeof item.text === "string"
          ? item.text
          : ""
      )
      .join("");
  }

  return "";
}

async function consumeSseStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (eventName: string | null, payload: Record<string, unknown>) => void
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName: string | null = null;
  let dataLines: string[] = [];

  const flush = () => {
    if (!dataLines.length) {
      eventName = null;
      return;
    }

    const raw = dataLines.join("\n");
    dataLines = [];

    if (raw === "[DONE]") {
      eventName = null;
      return;
    }

    try {
      onEvent(eventName, JSON.parse(raw) as Record<string, unknown>);
    } catch {
      onEvent(eventName, { raw });
    } finally {
      eventName = null;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventName = line.slice("event:".length).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice("data:".length).trimStart());
      } else if (line.trim() === "") {
        flush();
      }
    }
  }

  if (buffer.trim()) {
    dataLines.push(buffer.trim());
  }
  flush();
}

export async function callOpenClaw(opts: {
  instructions?: string;
  input: string;
  user?: string;
  stream?: boolean;
}): Promise<ReadableStream<Uint8Array> | OpenClawResponse> {
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL;
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;

  if (!gatewayUrl || !gatewayToken) {
    throw new Error(
      "OpenClaw not configured. Set OPENCLAW_GATEWAY_URL and OPENCLAW_GATEWAY_TOKEN."
    );
  }

  const body = {
    model: "openclaw/default",
    user: opts.user ?? "chieflane-shell",
    instructions:
      opts.instructions ??
      [
        "You are the Chieflane chief of staff agent.",
        "Use surface_publish / surface_patch / surface_close as needed.",
        "Be concise in any fallback chat text.",
      ].join("\n"),
    input: opts.input,
    stream: opts.stream ?? false,
  };

  const response = await fetch(`${gatewayUrl}/v1/responses`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${gatewayToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenClaw request failed (${response.status}): ${text}`);
  }

  if (opts.stream && response.body) {
    return response.body;
  }

  return response.json() as Promise<OpenClawResponse>;
}

export async function runAgentAction(opts: {
  actionKey: string;
  actionInstruction: string;
  actionRunId: string;
  surface: StoredSurface;
  input?: Record<string, unknown>;
}) {
  const instructions = [
    "You are executing an action from the Chieflane shell.",
    "Prefer updating the existing surface rather than creating duplicate work.",
    "Use surface_publish / surface_patch / surface_close as needed.",
    "Be concise in any fallback chat text.",
    `Action objective: ${opts.actionInstruction}`,
  ].join("\n");

  const input = [
    `Action: ${opts.actionKey}`,
    `Surface JSON: ${JSON.stringify(opts.surface)}`,
    `Action input JSON: ${JSON.stringify(opts.input ?? {})}`,
  ].join("\n\n");

  const response = (await callOpenClaw({
    instructions,
    input,
    user: `surface:${opts.surface.id}`,
    stream: true,
  })) as ReadableStream<Uint8Array>;

  let transcript = "";

  await consumeSseStream(response, (eventName, payload) => {
    const delta = extractText(payload);
    const payloadType =
      typeof payload.type === "string" ? payload.type : "message";
    if (delta) {
      transcript += delta;
    }

    fanoutEvent({
      type: "action.progress",
      surfaceId: opts.surface.id,
      data: {
        actionKey: opts.actionKey,
        actionRunId: opts.actionRunId,
        event: eventName ?? payloadType,
        text: delta || undefined,
      },
    });
  });

  return {
    ok: true,
    message:
      transcript.trim() ||
      `Completed ${opts.actionKey.replaceAll("_", " ")}`,
    output: {
      transcript: transcript.trim(),
    },
  };
}
