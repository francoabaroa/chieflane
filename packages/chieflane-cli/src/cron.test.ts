import assert from "node:assert/strict";
import test from "node:test";
import { buildCronArgs, parseListedCronJobs } from "./cron";

test("buildCronArgs uses timeout-seconds for job runtime", () => {
  const args = buildCronArgs({
    name: "morning-ops",
    cron: "0 9 * * 1-5",
    timezone: "America/New_York",
    timeoutSeconds: 300,
    message: "Run morning ops",
  });

  assert.ok(args.includes("--timeout-seconds"));
  assert.ok(!args.includes("--timeout"));
  assert.equal(args[args.indexOf("--timeout-seconds") + 1], "300");
});

test("parseListedCronJobs accepts wrapped cron list output", () => {
  const jobs = parseListedCronJobs('{"jobs":[{"id":"1","name":"morning-ops"}]}');

  assert.deepEqual(jobs, [{ id: "1", name: "morning-ops" }]);
});

test("parseListedCronJobs rejects output without JSON payloads", () => {
  assert.throws(() => parseListedCronJobs("cron list failed"), /Unable to find JSON/);
});

test("parseListedCronJobs accepts array cron list output", () => {
  const jobs = parseListedCronJobs('[{"id":"1","name":"morning-ops"}]');

  assert.deepEqual(jobs, [{ id: "1", name: "morning-ops" }]);
});
