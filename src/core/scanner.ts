import { join } from "node:path";
import type { Provider } from "../providers/registry.js";
import { exists } from "../utils/fs.js";

export interface ScanResult {
  provider: Provider;
  foundPaths: string[];
  missingPaths: string[];
}

export async function scanProviders(
  dir: string,
  providers: Provider[],
): Promise<ScanResult[]> {
  const results: ScanResult[] = [];

  for (const provider of providers) {
    const foundPaths: string[] = [];
    const missingPaths: string[] = [];

    for (const p of provider.paths) {
      const fullPath = join(dir, p);
      if (await exists(fullPath)) {
        foundPaths.push(p);
      } else {
        missingPaths.push(p);
      }
    }

    results.push({ provider, foundPaths, missingPaths });
  }

  return results;
}

export function hasAnyProvider(results: ScanResult[]): boolean {
  return results.some((r) => r.foundPaths.length > 0);
}
