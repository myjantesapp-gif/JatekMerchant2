import assert from "node:assert/strict";
import test from "node:test";

import { detectVideoMimeFromMagic } from "./videoMime";

function isoFile(brand: string): Buffer {
  const buffer = Buffer.alloc(16);
  buffer.write("ftyp", 4, "ascii");
  buffer.write(brand, 8, "ascii");
  return buffer;
}

test("video MIME detection accepts supported ISO video brands", () => {
  assert.equal(detectVideoMimeFromMagic(isoFile("isom")), "video/mp4");
  assert.equal(detectVideoMimeFromMagic(isoFile("mp42")), "video/mp4");
  assert.equal(detectVideoMimeFromMagic(isoFile("qt  ")), "video/quicktime");
  assert.equal(detectVideoMimeFromMagic(isoFile("3gp6")), "video/3gpp");
  assert.equal(detectVideoMimeFromMagic(isoFile("M4V ")), "video/x-m4v");
});

test("video MIME detection rejects known non-video ISO base media brands", () => {
  for (const brand of ["avif", "avis", "heic", "heix", "mif1", "msf1"]) {
    assert.equal(detectVideoMimeFromMagic(isoFile(brand)), null, brand);
  }
});