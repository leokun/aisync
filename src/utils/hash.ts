import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

export async function hashFile(path: string): Promise<string> {
  const content = await readFile(path);
  return createHash("sha256").update(content).digest("hex").slice(0, 8);
}

export async function hashDirectory(dirPath: string): Promise<string> {
  const hash = createHash("sha256");
  const entries = await collectFiles(dirPath);
  entries.sort();

  for (const entry of entries) {
    const content = await readFile(entry);
    hash.update(entry.slice(dirPath.length));
    hash.update(content);
  }

  return hash.digest("hex").slice(0, 8);
}

async function collectFiles(dirPath: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

export async function hashItem(path: string): Promise<string> {
  const s = await stat(path);
  return s.isDirectory() ? hashDirectory(path) : hashFile(path);
}
