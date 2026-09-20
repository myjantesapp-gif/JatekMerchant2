import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "@replit/object-storage";

const PAGE_SIZE = 2_000;
const outputRoot = path.resolve(process.env.OUTPUT_DIR ?? "./app-storage-export");
const client = new Client();

async function listAllObjects(): Promise<string[]> {
  const names: string[] = [];
  let startOffset: string | undefined;
  let previousLastName = "";

  while (true) {
    const result = await client.list({
      maxResults: PAGE_SIZE,
      ...(startOffset ? { startOffset } : {}),
    });

    if (!result.ok) {
      throw new Error(`Unable to list objects: ${result.error.message}`);
    }

    for (const object of result.value) {
      if (!object.name.endsWith("/") && object.name > previousLastName) {
        names.push(object.name);
      }
    }

    const lastName = result.value.at(-1)?.name;
    if (!lastName || result.value.length < PAGE_SIZE) break;
    if (lastName <= previousLastName) {
      throw new Error("Storage pagination did not advance safely");
    }

    previousLastName = lastName;
    startOffset = lastName;
  }

  return [...new Set(names)].sort();
}

async function main(): Promise<void> {
  const names = await listAllObjects();
  await mkdir(outputRoot, { recursive: true });

  for (const name of names) {
    const result = await client.downloadAsBytes(name);
    if (!result.ok) {
      throw new Error(`Unable to download ${name}: ${result.error.message}`);
    }

    const destination = path.resolve(outputRoot, name);
    const relative = path.relative(outputRoot, destination);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Unsafe object path: ${name}`);
    }

    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, result.value[0]);
    console.log(`Downloaded ${name}`);
  }

  console.log(`Completed: ${names.length} files`);
  console.log(`Output: ${outputRoot}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});