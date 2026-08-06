import test from "node:test";
import assert from "node:assert/strict";
import { parseArgs, parseEventStream, summarizePayload } from "../scripts/kling-monitor.mjs";

test("validates monitor arguments", () => {
  assert.equal(parseArgs(["--port=4320", "--interval-seconds=10"]).port, 4320);
  assert.throws(() => parseArgs(["--port=0"]));
  assert.throws(() => parseArgs(["--interval-seconds=1"]));
});

test("parses JSON-RPC SSE responses", () => {
  const value = parseEventStream("data: {\"id\":2,\"result\":{}}\n\n", 2);
  assert.deepEqual(value, { id: 2, result: {} });
});

test("summarizes terminal payloads and media URLs", () => {
  assert.deepEqual(summarizePayload({ status: "succeeded", url: "https://example.com/a.mp4" }), {
    status: "SUCCEEDED",
    terminal: true,
    urls: ["https://example.com/a.mp4"]
  });
});
