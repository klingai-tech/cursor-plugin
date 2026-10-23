import assert from "node:assert/strict";
import test from "node:test";

import { verifyPlugin } from "../scripts/verify-plugin.mjs";

test("the China Cursor plugin satisfies its package contract", () => {
  const result = verifyPlugin();

  assert.deepEqual(result, {
    name: "kling-ai",
    endpoint: "https://klingai.com/mcp",
    version: "1.4.0"
  });
});
