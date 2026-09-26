import assert from "node:assert/strict";
import test from "node:test";

import {
  getMediaUrlCandidates,
  getYouTubeThumbnailUrl,
  getYouTubeVideoId,
  resolveMediaUrl,
} from "../lib/mediaUrl";
import { getApiBase, getApiBaseSafe } from "../lib/apiBase";

test("pins all business requests to the canonical remote API", () => {
  assert.equal(getApiBase(), "https://api.jatek.app");
  assert.equal(getApiBaseSafe(), "https://api.jatek.app");
});

test("resolves every supported App Storage path through the real API route", () => {
  assert.equal(
    resolveMediaUrl("/objects/medias/product-id"),
    "https://api.jatek.app/api/storage/objects/medias/product-id",
  );
  assert.equal(
    resolveMediaUrl("objects/shorts/video-id?version=2"),
    "https://api.jatek.app/api/storage/objects/shorts/video-id?version=2",
  );
  assert.equal(
    resolveMediaUrl("/api/storage/objects/banners/banner-id"),
    "https://api.jatek.app/api/storage/objects/banners/banner-id",
  );
  assert.equal(
    resolveMediaUrl("https://api.jatek.app/objects/logos/logo-id"),
    "https://api.jatek.app/api/storage/objects/logos/logo-id",
  );
  assert.equal(
    resolveMediaUrl("https://ma.jatek.app/objects/logos/logo-id?size=small"),
    "https://api.jatek.app/api/storage/objects/logos/logo-id?size=small",
  );
});

test("preserves valid external media and rejects unsafe persisted schemes", () => {
  assert.equal(resolveMediaUrl(" https://cdn.example.com/image.webp "), "https://cdn.example.com/image.webp");
  assert.equal(resolveMediaUrl("//cdn.example.com/image.webp"), "https://cdn.example.com/image.webp");
  assert.equal(resolveMediaUrl("javascript:alert(1)"), undefined);
  assert.equal(resolveMediaUrl("file:///private/image.jpg"), undefined);
  assert.equal(resolveMediaUrl("blob:https://ma.jatek.app/transient"), undefined);
  assert.equal(resolveMediaUrl("#not-media"), undefined);
});

test("deduplicates fallbacks and derives posters for supported YouTube URLs", () => {
  const video = "youtube.com/shorts/dQw4w9WgXcQ";
  assert.equal(getYouTubeVideoId(video), "dQw4w9WgXcQ");
  assert.equal(getYouTubeThumbnailUrl(video), "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  assert.deepEqual(
    getMediaUrlCandidates("/objects/images/a", " /objects/images/a ", null, "https://cdn.example.com/a"),
    [
      "https://api.jatek.app/api/storage/objects/images/a",
      "https://cdn.example.com/a",
    ],
  );
});