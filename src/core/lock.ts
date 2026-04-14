import { join } from "node:path";
import { exists, readJson, writeJson } from "../utils/fs.js";
import type { CopyItem } from "./copier.js";

export const LOCK_FILENAME = "aisync-lock.json";

export interface LockFile {
  version: number;
  source: string;
  lastSync: string;
  mode: "copy" | "link";
  items: LockItem[];
}

export interface LockItem {
  path: string;
  type: "file" | "directory";
  provider: string;
  hash: string;
  syncedAt: string;
}

export async function readLock(dir: string): Promise<LockFile | null> {
  const lockPath = join(dir, LOCK_FILENAME);
  if (!(await exists(lockPath))) {
    return null;
  }
  return readJson<LockFile>(lockPath);
}

export async function writeLock(
  dir: string,
  source: string,
  items: CopyItem[],
): Promise<void> {
  const now = new Date().toISOString();
  const lock: LockFile = {
    version: 1,
    source,
    lastSync: now,
    mode: "copy",
    items: items.map((item) => ({
      path: item.path,
      type: item.type,
      provider: item.provider,
      hash: item.hash,
      syncedAt: now,
    })),
  };
  await writeJson(join(dir, LOCK_FILENAME), lock);
}
