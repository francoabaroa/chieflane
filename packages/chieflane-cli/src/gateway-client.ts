import { requestJson } from "./http-client";

export async function invokeGatewayTool(
  gatewayUrl: string,
  gatewayToken: string,
  tool: string,
  args: Record<string, unknown>
) {
  const response = await requestJson<{ ok?: boolean; error?: unknown }>(
    `${gatewayUrl}/tools/invoke`,
    {
      method: "POST",
      followRedirects: true,
      headers: {
        authorization: `Bearer ${gatewayToken}`,
      },
      body: {
        tool,
        action: "json",
        args,
        sessionKey: "main",
        dryRun: false,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Tool ${tool} failed (${response.status}): ${response.text}`);
  }

  if (response.json == null) {
    throw new Error(
      `Tool ${tool} returned a non-JSON response: ${response.parseError ?? response.text}`
    );
  }

  if (response.json.ok === false) {
    throw new Error(
      `Tool ${tool} returned error: ${JSON.stringify(response.json.error)}`
    );
  }

  return response.json;
}

export async function runGatewayResponse(args: {
  gatewayUrl: string;
  gatewayToken: string;
  instructions: string;
  input: string;
  user: string;
}) {
  const response = await requestJson<Record<string, unknown>>(
    `${args.gatewayUrl}/v1/responses`,
    {
      method: "POST",
      followRedirects: true,
      headers: {
        authorization: `Bearer ${args.gatewayToken}`,
      },
      body: {
        model: "openclaw/default",
        user: args.user,
        instructions: args.instructions,
        input: args.input,
        stream: false,
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Gateway response request failed (${response.status}): ${response.text}`
    );
  }

  if (response.json == null) {
    throw new Error(
      `Gateway response request returned a non-JSON body: ${response.parseError ?? response.text}`
    );
  }

  return response.json;
}
