import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Provider } from "../../src/providers/registry.js";

export async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "aisync-test-"));
}

export async function removeTempDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

export async function scaffold(
  base: string,
  files: Record<string, string>,
): Promise<void> {
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = join(base, relPath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, "utf-8");
  }
}

export const fakeProvider: Provider = {
  name: "test-provider",
  label: "Test Provider",
  paths: ["test-config/", "test-file.md"],
};
