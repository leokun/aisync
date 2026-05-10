import { join } from "node:path";
import { exists, removeItem } from "../utils/fs.js";
import { LOCK_FILENAME, readLock } from "./lock.js";

export interface CleanResult {
  destination: string;
  removed: string[];
  notFound: string[];
  lockRemoved: boolean;
}

export class CleanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CleanError";
  }
}

export async function cleanWorktree(
  destination: string,
  options: { dryRun: boolean },
): Promise<CleanResult> {
  const lock = await readLock(destination);
  if (!lock) {
    throw new CleanError(
      `No aisync-lock.json found in ${destination}. Nothing to clean.`,
    );
  }

  const removed: string[] = [];
  const notFound: string[] = [];

  for (const item of lock.items) {
    const itemPath = join(destination, item.path);
    if (await exists(itemPath)) {
      if (!options.dryRun) {
        await removeItem(itemPath);
      }
      removed.push(item.path);
    } else {
      notFound.push(item.path);
    }
  }

  let lockRemoved = false;
  const lockPath = join(destination, LOCK_FILENAME);
  if (await exists(lockPath)) {
    if (!options.dryRun) {
      await removeItem(lockPath);
    }
    lockRemoved = true;
  }

  return { destination, removed, notFound, lockRemoved };
}
