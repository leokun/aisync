import { join } from "node:path";
import type { Provider } from "../providers/registry.js";
import { copyItem, exists, isDirectory } from "../utils/fs.js";
import { hashItem } from "../utils/hash.js";
import type { LockFile } from "./lock.js";

export interface CopyItem {
  path: string;
  type: "file" | "directory";
  provider: string;
  hash: string;
}

export interface CopyResult {
  copied: CopyItem[];
  skipped: string[];
  drifted: string[];
}

export interface CopyOptions {
  force: boolean;
  dryRun: boolean;
  lock?: LockFile | null;
  onBeforeWrite?: (absDestPath: string) => void;
  onAfterWrite?: (absDestPath: string) => void;
}

export async function copyProviders(
  source: string,
  destination: string,
  providers: Provider[],
  options: CopyOptions,
): Promise<CopyResult> {
  const copied: CopyItem[] = [];
  const skipped: string[] = [];
  const drifted: string[] = [];

  const lockItems = new Map<string, string>();
  if (options.lock) {
    for (const item of options.lock.items) {
      if (item.hash) lockItems.set(item.path, item.hash);
    }
  }

  for (const provider of providers) {
    for (const relativePath of provider.paths) {
      const srcPath = join(source, relativePath);
      const destPath = join(destination, relativePath);

      if (!(await exists(srcPath))) {
        continue;
      }

      const destExists = await exists(destPath);
      const lockedHash = lockItems.get(relativePath);

      if (destExists && lockedHash) {
        const destHash = await hashItem(destPath);
        if (destHash !== lockedHash) {
          if (!options.force) {
            drifted.push(relativePath);
            continue;
          }
        }
      }

      if (destExists && !options.force) {
        skipped.push(relativePath);
        continue;
      }

      const type = (await isDirectory(srcPath)) ? "directory" : "file";

      if (!options.dryRun) {
        options.onBeforeWrite?.(destPath);
        await copyItem(srcPath, destPath);
        options.onAfterWrite?.(destPath);
      }

      const hash = await hashItem(srcPath);
      copied.push({ path: relativePath, type, provider: provider.name, hash });
    }
  }

  return { copied, skipped, drifted };
}
