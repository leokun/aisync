import { randomBytes } from "node:crypto";
import { cp, mkdir, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

export async function copyItem(src: string, dest: string): Promise<void> {
  const srcStat = await stat(src);
  await mkdir(dirname(dest), { recursive: true });

  if (srcStat.isDirectory()) {
    await cp(src, dest, { recursive: true });
  } else {
    // Atomic copy: write to temp file then rename
    const tmpPath = join(
      dirname(dest),
      `.aisync-tmp-${randomBytes(4).toString("hex")}`,
    );
    await cp(src, tmpPath);
    await rename(tmpPath, dest);
  }
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

export async function readJson<T>(path: string): Promise<T> {
  const { readFile } = await import("node:fs/promises");
  const content = await readFile(path, "utf-8");
  return JSON.parse(content) as T;
}
