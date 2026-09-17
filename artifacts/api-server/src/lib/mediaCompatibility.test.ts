import assert from "node:assert/strict";
import test from "node:test";

import { resolveLegacyMediaPath } from "./objectStorage";
import { ShortViewDeduper, normalizeShortViewCount } from "./shortViews";
import { serializeShort } from "../routes/content";

test("legacy media paths are remapped to their field-specific storage folder", () => {
  assert.equal(
    resolveLegacyMediaPath("/api/storage/objects/uploads/product-id", "medias"),
    "/api/storage/objects/medias/product-id",
  );
  assert.equal(
    resolveLegacyMediaPath("/objects/uploads/short-id", "shorts"),
    "/api/storage/objects/shorts/short-id",
  );
  assert.equal(
    resolveLegacyMediaPath("uploads/banner-id?version=2", "banners"),
    "/api/storage/objects/banners/banner-id?version=2",
  );
});

test("third-party and already typed media paths remain backend-driven", () => {
  assert.equal(
    resolveLegacyMediaPath("https://cdn.example.com/catalog/product.webp", "medias"),
    "https://cdn.example.com/catalog/product.webp",
  );
  assert.equal(
    resolveLegacyMediaPath("/api/storage/objects/shorts/video-id", "shorts"),
    "/api/storage/objects/shorts/video-id",
  );
});

test("Short serialization always exposes the canonical numeric viewCount", () => {
  const row = {
    id: 7,
    title: "Uploaded Short",
    imageUrl: null,
    videoUrl: "/api/storage/objects/shorts/video-id",
    restaurantId: null,
    restaurantName: null,
    audioCodec: null,
    audioBitrate: null,
    durationSeconds: null,
    viewCount: 0,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };

  assert.equal(serializeShort(row).viewCount, 0);
  assert.equal(normalizeShortViewCount(undefined), 0);
});

test("Short play sessions increment at most once and can retry after failure", () => {
  const deduper = new ShortViewDeduper();
  assert.equal(deduper.claim(7, "session_123456"), true);
  assert.equal(deduper.claim(7, "session_123456"), false);
  assert.equal(deduper.claim(8, "session_123456"), true);
  deduper.release(7, "session_123456");
  assert.equal(deduper.claim(7, "session_123456"), true);
});