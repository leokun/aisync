import { join } from "node:path";
import { exists, readJson, writeJson } from "../utils/fs.js";
import type { CopyItem } from "./copier.js";
import type { LinkItem } from "./linker.js";

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
  hash?: string;
  target?: string;
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
  mode?: "copy",
): Promise<void>;
export async function writeLock(
  dir: string,
  source: string,
  items: LinkItem[],
  mode: "link",
): Promise<void>;
export async function writeLock(
  dir: string,
  source: string,
  items: CopyItem[] | LinkItem[],
  mode: "copy" | "link" = "copy",
): Promise<void> {
  const now = new Date().toISOString();
  const lock: LockFile = {
    version: 1,
    source,
    lastSync: now,
    mode,
    items: items.map((item) => {
      const base: LockItem = {
        path: item.path,
        type: item.type,
        provider: item.provider,
        syncedAt: now,
      };
      if (mode === "link") {
        base.target = (item as LinkItem).target;
      } else {
        base.hash = (item as CopyItem).hash;
      }
      return base;
    }),
  };
  await writeJson(join(dir, LOCK_FILENAME), lock);
}
