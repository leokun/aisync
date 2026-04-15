import { dirname, relative, resolve } from "node:path";
import type { Provider } from "../providers/registry.js";
import { exists, isDirectory, linkItem, removeItem } from "../utils/fs.js";

export interface LinkItem {
  path: string;
  type: "file" | "directory";
  provider: string;
  target: string;
}

export interface LinkResult {
  linked: LinkItem[];
  skipped: string[];
}

export async function linkProviders(
  source: string,
  destination: string,
  providers: Provider[],
  options: { force: boolean; dryRun: boolean },
): Promise<LinkResult> {
  const linked: LinkItem[] = [];
  const skipped: string[] = [];

  for (const provider of providers) {
    for (const relativePath of provider.paths) {
      const srcPath = resolve(source, relativePath);
      const destPath = resolve(destination, relativePath);

      if (!(await exists(srcPath))) {
        continue;
      }

      if ((await exists(destPath)) && !options.force) {
        skipped.push(relativePath);
        continue;
      }

      const type = (await isDirectory(srcPath)) ? "directory" : "file";
      const target = relative(dirname(destPath), srcPath);

      if (!options.dryRun) {
        if (options.force && (await exists(destPath))) {
          await removeItem(destPath);
        }
        await linkItem(target, destPath);
      }

      linked.push({
        path: relativePath,
        type,
        provider: provider.name,
        target,
      });
    }
  }

  return { linked, skipped };
}
