import assert from "node:assert/strict";
import test from "node:test";
import { surfaceEnvelopeSchema } from "./index";
import { surfaceContracts } from "./contracts";

test("all minimal surface contract examples validate against the zod schema", () => {
  for (const contract of Object.values(surfaceContracts)) {
    assert.doesNotThrow(() => {
      surfaceEnvelopeSchema.parse(contract.minimalExample);
    }, contract.surfaceType);
  }
});
