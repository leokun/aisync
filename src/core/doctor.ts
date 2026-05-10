import { join } from "node:path";
import { exists } from "../utils/fs.js";
import { hashItem } from "../utils/hash.js";
import { type LockFile, readLock } from "./lock.js";

export type ItemStatus =
  | "synced"
  | "stale"
  | "drift"
  | "conflict"
  | "missing-source"
  | "missing-dest";

export interface DoctorItem {
  path: string;
  provider: string;
  type: "file" | "directory";
  status: ItemStatus;
  lockHash?: string;
  sourceHash?: string;
  destHash?: string;
  target?: string;
}

export interface DoctorReport {
  destination: string;
  source: string;
  lastSync: string;
  mode: "copy" | "link";
  items: DoctorItem[];
  counts: Record<ItemStatus, number>;
}

export class DoctorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DoctorError";
  }
}

export async function diagnose(destination: string): Promise<DoctorReport> {
  const lock = await readLock(destination);
  if (!lock) {
    throw new DoctorError(
      "No aisync-lock.json found in destination. Run `aisync copy` or `aisync link` first.",
    );
  }

  const items: DoctorItem[] = [];
  for (const lockItem of lock.items) {
    items.push(await diagnoseItem(destination, lock, lockItem));
  }

  const counts = countStatuses(items);

  return {
    destination,
    source: lock.source,
    lastSync: lock.lastSync,
    mode: lock.mode,
    items,
    counts,
  };
}

async function diagnoseItem(
  destination: string,
  lock: LockFile,
  lockItem: LockFile["items"][number],
): Promise<DoctorItem> {
  const srcPath = join(lock.source, lockItem.path);
  const destPath = join(destination, lockItem.path);
  const srcExists = await exists(srcPath);
  const destExists = await exists(destPath);

  const base: DoctorItem = {
    path: lockItem.path,
    provider: lockItem.provider,
    type: lockItem.type,
    status: "synced",
    lockHash: lockItem.hash,
    target: lockItem.target,
  };

  if (!srcExists) {
    return { ...base, status: "missing-source" };
  }
  if (!destExists) {
    return { ...base, status: "missing-dest" };
  }

  if (lock.mode === "link") {
    return base;
  }

  const sourceHash = await hashItem(srcPath);
  const destHash = await hashItem(destPath);
  const stale = sourceHash !== lockItem.hash;
  const drift = destHash !== lockItem.hash;

  let status: ItemStatus = "synced";
  if (stale && drift) status = "conflict";
  else if (stale) status = "stale";
  else if (drift) status = "drift";

  return { ...base, status, sourceHash, destHash };
}

function countStatuses(items: DoctorItem[]): Record<ItemStatus, number> {
  const counts: Record<ItemStatus, number> = {
    synced: 0,
    stale: 0,
    drift: 0,
    conflict: 0,
    "missing-source": 0,
    "missing-dest": 0,
  };
  for (const item of items) {
    counts[item.status]++;
  }
  return counts;
}
