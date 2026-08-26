import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Orval currently emits Zod 4 top-level helpers while this workspace uses Zod 3.
// Keep the generated output reproducible without hand-editing generated files.
const generated = resolve("..", "api-zod", "src", "generated", "api.ts");
let source = await readFile(generated, "utf8");
source = source
  .replaceAll("zod.int()", "zod.number().int()")
  .replaceAll("zod.email()", "zod.string().email()")
  .replaceAll("zod.url()", "zod.string().url()");
await writeFile(generated, source);