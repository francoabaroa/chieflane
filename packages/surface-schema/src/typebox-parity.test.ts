import assert from "node:assert/strict";
import test from "node:test";
import { Value } from "@sinclair/typebox/value";
import { commonSurfaceContractOrder, surfaceContracts } from "./contracts";
import { SurfacePayloadTB } from "./typebox";

test("typebox payload schema accepts all common minimal contract payloads", () => {
  for (const surfaceType of commonSurfaceContractOrder) {
    const contract = surfaceContracts[surfaceType];
    assert.equal(
      Value.Check(SurfacePayloadTB, contract.minimalExample.payload),
      true,
      surfaceType
    );
  }
});
