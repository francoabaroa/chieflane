import assert from "node:assert/strict";
import test from "node:test";
import { surfaceEnvelopeSchema } from "./index";
import {
  renderChiefShellSkillMarkdown,
  renderToolsSurfaceContractMarkdown,
} from "./agent-docs";

function extractJsonBlocks(markdown: string) {
  return Array.from(markdown.matchAll(/```json\n([\s\S]*?)\n```/g)).map(
    (match) => match[1]
  );
}

test("generated tools markdown stays compact", () => {
  const markdown = renderToolsSurfaceContractMarkdown();
  assert.ok(markdown.length < 6000, `tools markdown length=${markdown.length}`);
});

test("generated tools markdown examples validate", () => {
  const markdown = renderToolsSurfaceContractMarkdown();
  const [publishJson] = extractJsonBlocks(markdown);
  assert.ok(publishJson);
  assert.doesNotThrow(() => {
    surfaceEnvelopeSchema.parse(JSON.parse(publishJson));
  });
});

test("generated docs do not claim actions are required", () => {
  const tools = renderToolsSurfaceContractMarkdown();
  const skill = renderChiefShellSkillMarkdown();

  assert.ok(!/actions are required/i.test(tools));
  assert.ok(!/actions are required/i.test(skill));
});
