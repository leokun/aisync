import { copyProviders } from "../core/copier.js";
import { writeLock } from "../core/lock.js";
import { scanProviders } from "../core/scanner.js";
import { filterProviders } from "../providers/registry.js";
import * as log from "../utils/logger.js";
import { resolveSourceDest, type SyncOptions, validateSource } from "./sync.js";

export async function copy(
  sourceArg: string | undefined,
  destArg: string | undefined,
  options: SyncOptions,
): Promise<void> {
  log.setVerbose(options.verbose);

  const resolved = await resolveSourceDest(sourceArg, destArg, "copy");
  if (!resolved) return;

  const { source, destination, fromLock } = resolved;
  if (!(await validateSource(source))) return;

  const providers = filterProviders(options.only, options.exclude);
  const scanResults = await scanProviders(source, providers);
  const activeProviders = providers.filter(
    (_, i) => scanResults[i].foundPaths.length > 0,
  );

  const dryLabel = options.dryRun ? " (dry run)" : "";
  log.header(`copy${dryLabel}`);

  console.log(`  Source: ${source}`);
  if (fromLock) {
    console.log(`  Destination: . (from aisync-lock.json)`);
  } else {
    console.log(`  Destination: ${destination}`);
  }
  console.log(
    `  Providers: ${activeProviders.map((p) => p.name).join(" ") || "none found"}`,
  );
  console.log();

  if (activeProviders.length === 0) {
    log.warn("No providers found in source directory.");
    return;
  }

  const result = await copyProviders(source, destination, activeProviders, {
    force: options.force,
    dryRun: options.dryRun,
  });

  if (options.dryRun) {
    console.log("  Would copy:");
    for (const item of result.copied) {
      log.item(item.path, `(${item.type})`);
    }
    for (const path of result.skipped) {
      log.item(path, "(exists, use --force to overwrite)");
    }
    console.log();
    console.log("  No changes made. Remove --dry-run to apply.");
  } else {
    console.log("  Copying...");
    for (const item of result.copied) {
      log.item(item.path, "✓");
    }
    for (const path of result.skipped) {
      log.item(path, "skipped (exists, use --force)");
    }

    if (result.copied.length > 0) {
      await writeLock(destination, source, result.copied, "copy");
    }

    console.log();
    log.success(`${result.copied.length} item(s) copied`);
    if (result.skipped.length > 0) {
      log.warn(`${result.skipped.length} item(s) skipped`);
    }
    if (result.copied.length > 0) {
      log.success("aisync-lock.json written");
    }
  }

  console.log();
  console.log("  Done!");
  console.log();
}
