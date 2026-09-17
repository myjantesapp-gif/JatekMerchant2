const NON_VIDEO_ISO_BRANDS = new Set([
  "avif", "avis",
  "heic", "heix", "hevc", "hevx", "heim", "heis",
  "mif1", "msf1",
]);

/** Detect supported video containers from their signatures, not client metadata. */
export function detectVideoMimeFromMagic(buf: Buffer): string | null {
  // ISO Base Media files (MP4/MOV) declare the file type at bytes 4–11.
  if (buf.length >= 12 && buf.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("ascii");
    if (NON_VIDEO_ISO_BRANDS.has(brand.toLowerCase())) return null;
    if (brand === "qt  ") return "video/quicktime";
    if (brand.startsWith("3gp") || brand.startsWith("3g2")) return "video/3gpp";
    if (brand.startsWith("M4V")) return "video/x-m4v";
    return "video/mp4";
  }
  // WebM is an EBML container and must include its document type in the header.
  if (
    buf.length >= 64 &&
    buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3 &&
    buf.subarray(0, Math.min(buf.length, 256)).includes(Buffer.from("webm"))
  ) return "video/webm";
  return null;
}