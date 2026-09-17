import assert from "node:assert/strict";
import test from "node:test";
import { loadStartupVideoUrl } from "./startupVideo";

const response = (json: unknown, status = 200) => (async () => new Response(JSON.stringify(json), { status })) as typeof fetch;

test("startup chooses backend media or the bundled fallback", async () => {
  assert.equal(await loadStartupVideoUrl("https://example.com", response({ splashVideoUrl: " /api/storage/objects/splash/one " })), "/api/storage/objects/splash/one");
  for (const config of [{}, null, { splashVideoUrl: "" }, { splashVideoUrl: 5 }]) {
    assert.equal(await loadStartupVideoUrl("https://example.com", response(config)), null);
  }
  assert.equal(await loadStartupVideoUrl("https://example.com", response({}, 503)), null);
});

test("an unresponsive config request cannot block app startup", async () => {
  const pending = (() => new Promise(() => {})) as typeof fetch;
  assert.equal(await loadStartupVideoUrl("https://example.com", pending, 10), null);
});