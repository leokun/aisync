import { join } from "node:path";
import type { Provider } from "../providers/registry.js";
import { copyItem, exists, isDirectory } from "../utils/fs.js";
import { hashItem } from "../utils/hash.js";

export interface CopyItem {
  path: string;
  type: "file" | "directory";
  provider: string;
  hash: string;
}

export interface CopyResult {
  copied: CopyItem[];
  skipped: string[];
}

export async function copyProviders(
  source: string,
  destination: string,
  providers: Provider[],
  options: { force: boolean; dryRun: boolean },
): Promise<CopyResult> {
  const copied: CopyItem[] = [];
  const skipped: string[] = [];

  for (const provider of providers) {
    for (const relativePath of provider.paths) {
      const srcPath = join(source, relativePath);
      const destPath = join(destination, relativePath);

      if (!(await exists(srcPath))) {
        continue;
      }

      if ((await exists(destPath)) && !options.force) {
        skipped.push(relativePath);
        continue;
      }

      const type = (await isDirectory(srcPath)) ? "directory" : "file";

      if (!options.dryRun) {
        await copyItem(srcPath, destPath);
      }

      const hash = await hashItem(srcPath);
      copied.push({ path: relativePath, type, provider: provider.name, hash });
    }
  }

  return { copied, skipped };
}
