import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import {
  extname,
  relative,
  resolve,
} from "node:path";

interface InventoryEntry {
  path: string;
  extension: string;
  size: number;
  sha256: string;
}

const sourceDirectory = resolve(
  process.argv[2] ??
    ".local/facturx-source/extracted",
);

if (!existsSync(sourceDirectory)) {
  console.error(
    `Source directory does not exist: ${sourceDirectory}`,
  );
  process.exit(1);
}

function sha256File(path: string): string {
  return createHash("sha256")
    .update(readFileSync(path))
    .digest("hex");
}

function walk(directory: string): string[] {
  const files: string[] = [];

  for (const name of readdirSync(directory)) {
    const path = resolve(directory, name);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      files.push(...walk(path));
      continue;
    }

    if (stats.isFile()) {
      files.push(path);
    }
  }

  return files;
}

const entries: InventoryEntry[] = walk(
  sourceDirectory,
)
  .sort()
  .map((path) => {
    const stats = statSync(path);

    return {
      path: relative(
        sourceDirectory,
        path,
      ).replaceAll("\\", "/"),
      extension:
        extname(path).toLowerCase() || "(none)",
      size: stats.size,
      sha256: sha256File(path),
    };
  });

const byExtension = new Map<string, number>();

for (const entry of entries) {
  byExtension.set(
    entry.extension,
    (byExtension.get(entry.extension) ?? 0) + 1,
  );
}

console.log("--- Factur-X package inventory ---");
console.log(`Source: ${sourceDirectory}`);
console.log(`Files: ${entries.length}`);
console.log("");

console.log("Files by extension:");

for (
  const [extension, count] of [...byExtension]
    .sort(([a], [b]) => a.localeCompare(b))
) {
  console.log(`- ${extension}: ${count}`);
}

console.log("");
console.log("Machine-readable inventory:");
console.log(JSON.stringify(entries, null, 2));