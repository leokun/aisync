import { readConfig } from "../core/config.js";
import { copyProviders } from "../core/copier.js";
import { writeLock } from "../core/lock.js";
import { scanProviders } from "../core/scanner.js";
import { buildProviders, filterProviders } from "../providers/registry.js";
import * as log from "../utils/logger.js";
import { isTTY } from "../utils/platform.js";
import { selectProviders } from "../utils/prompt.js";
import { resolveSourceDest, type SyncOptions, validateSource } from "./sync.js";

export async function copy(
  sourceArg: string | undefined,
  destArg: string | undefined,
  options: SyncOptions,
): Promise<void> {
  log.setVerbose(options.verbose);
  log.setQuiet(options.quiet ?? false);

  const config = await readConfig(".");
  const registry = buildProviders(config?.providers);

  const resolved = await resolveSourceDest(
    sourceArg,
    destArg,
    "copy",
    config?.source,
  );
  if (!resolved) return;

  const { source, destination, fromLock } = resolved;
  if (!(await validateSource(source))) return;

  const only = options.only ?? config?.only;
  const exclude = options.exclude ?? config?.exclude;

  const providers = filterProviders(only, exclude, registry);
  const scanResults = await scanProviders(source, providers);
  let activeProviders = providers.filter(
    (_, i) => scanResults[i].foundPaths.length > 0,
  );

  const noFilter = !only?.length && !exclude?.length;
  const wantsInteractive = options.interactive || (noFilter && isTTY());
  if (wantsInteractive && activeProviders.length > 1) {
    activeProviders = await selectProviders(activeProviders);
  }

  const dryLabel = options.dryRun ? " (dry run)" : "";
  log.header(`copy${dryLabel}`);

  log.log(`  Source: ${source}`);
  if (fromLock) {
    log.log(`  Destination: . (from aisync-lock.json)`);
  } else {
    log.log(`  Destination: ${destination}`);
  }
  log.log(
    `  Providers: ${activeProviders.map((p) => p.name).join(" ") || "none found"}`,
  );
  log.log("");

  if (activeProviders.length === 0) {
    log.warn("No providers found in source directory.");
    return;
  }

  const result = await copyProviders(source, destination, activeProviders, {
    force: options.force,
    dryRun: options.dryRun,
  });

  if (options.dryRun) {
    log.log("  Would copy:");
    for (const item of result.copied) {
      log.item(item.path, `(${item.type})`);
    }
    for (const path of result.skipped) {
      log.item(path, "(exists, use --force to overwrite)");
    }
    log.log("");
    log.log("  No changes made. Remove --dry-run to apply.");
  } else {
    log.log("  Copying...");
    for (const item of result.copied) {
      log.item(item.path, "✓");
    }
    for (const path of result.skipped) {
      log.item(path, "skipped (exists, use --force)");
    }

    if (result.copied.length > 0) {
      await writeLock(destination, source, result.copied, "copy");
    }

    log.log("");
    log.success(`${result.copied.length} item(s) copied`);
    if (result.skipped.length > 0) {
      log.warn(`${result.skipped.length} item(s) skipped`);
    }
    if (result.copied.length > 0) {
      log.success("aisync-lock.json written");
    }
  }

  log.log("");
  log.log("  Done!");
  log.log("");
}
