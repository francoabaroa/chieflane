import test from "node:test";
import assert from "node:assert/strict";
import { getSafeExternalHref } from "@chieflane/shared";

test("getSafeExternalHref allows safe absolute links", () => {
  assert.equal(
    getSafeExternalHref("https://docs.openclaw.ai/install"),
    "https://docs.openclaw.ai/install"
  );
  assert.equal(
    getSafeExternalHref("mailto:operator@example.com"),
    "mailto:operator@example.com"
  );
});

test("getSafeExternalHref rejects unsafe or relative links", () => {
  assert.equal(getSafeExternalHref("javascript:alert(1)"), null);
  assert.equal(getSafeExternalHref("/internal/path"), null);
  assert.equal(getSafeExternalHref("  "), null);
});
