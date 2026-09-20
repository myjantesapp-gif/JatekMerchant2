import assert from "node:assert/strict";
import test from "node:test";
import { loadStartupMedia, loadStartupVideoUrl } from "./startupVideo";

const response = (json: unknown, status = 200) => (async () => new Response(JSON.stringify(json), { status })) as typeof fetch;

test("startup chooses backend media or the bundled fallback", async () => {
  assert.equal(await loadStartupVideoUrl("https://example.com", response({ splashVideoUrl: " /api/storage/objects/splash/one " })), "/api/storage/objects/splash/one");
  for (const config of [{}, null, { splashVideoUrl: "" }, { splashVideoUrl: 5 }]) {
    assert.equal(await loadStartupVideoUrl("https://example.com", response(config)), null);
  }
  assert.equal(await loadStartupVideoUrl("https://example.com", response({}, 503)), null);
});

test("startup media returns the remote logo alongside the intro video", async () => {
  assert.deepEqual(
    await loadStartupMedia("https://example.com", response({
      splashVideoUrl: "/api/storage/objects/splash/intro.mp4",
      splashLogoUrl: "/api/storage/objects/splash/logo.png",
    })),
    {
      videoUrl: "/api/storage/objects/splash/intro.mp4",
      logoUrl: "/api/storage/objects/splash/logo.png",
    },
  );
});

test("an unresponsive config request cannot block app startup", async () => {
  const pending = (() => new Promise(() => {})) as typeof fetch;
  assert.deepEqual(await loadStartupMedia("https://example.com", pending, 10), { videoUrl: null, logoUrl: null });
});