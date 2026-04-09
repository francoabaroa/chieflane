import assert from "node:assert/strict";
import test from "node:test";
import { chooseGatewayPort, DEFAULT_GATEWAY_PORT } from "./ports";

test("chooseGatewayPort treats a literal default profile as shared", async () => {
  const result = await chooseGatewayPort({
    context: { profile: "default" },
    configuredPort: null,
    occupiedBasePorts: [DEFAULT_GATEWAY_PORT],
    canBind: async () => {
      throw new Error("shared profile planning should not probe bind availability");
    },
  });

  assert.equal(result.port, DEFAULT_GATEWAY_PORT);
  assert.equal(result.shouldWrite, false);
});

test("chooseGatewayPort revalidates a stale isolated configured port before keeping it", async () => {
  const result = await chooseGatewayPort({
    context: { dev: true },
    configuredPort: 19021,
    occupiedBasePorts: [19021],
    canBind: async () => true,
  });

  assert.equal(result.port, 19001);
  assert.equal(result.shouldWrite, true);
});
