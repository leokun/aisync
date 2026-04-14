import { resolve } from "node:path";
import { copyProviders } from "../core/copier.js";
import { readLock, writeLock } from "../core/lock.js";
import { scanProviders } from "../core/scanner.js";
import { filterProviders } from "../providers/registry.js";
import { exists, isDirectory } from "../utils/fs.js";
import * as log from "../utils/logger.js";

interface CopyOptions {
  only?: string[];
  exclude?: string[];
  dryRun: boolean;
  force: boolean;
  verbose: boolean;
}

export async function copy(
  sourceArg: string | undefined,
  destArg: string | undefined,
  options: CopyOptions,
): Promise<void> {
  log.setVerbose(options.verbose);

  let source: string;
  let destination: string;

  if (destArg) {
    source = resolve(sourceArg ?? ".");
    destination = resolve(destArg);
  } else if (sourceArg) {
    // Single arg: try lock file in cwd, sourceArg is destination
    const lock = await readLock(".");
    if (lock) {
      source = lock.source;
      destination = resolve(sourceArg);
    } else {
      source = resolve(".");
      destination = resolve(sourceArg);
    }
  } else {
    // No args: try lock file
    const lock = await readLock(".");
    if (!lock) {
      log.error("No destination specified and no aisync-lock.json found.");
      console.log();
      console.log("  Usage:");
      console.log("    npx aisync copy [source] <destination>");
      console.log();
      console.log("  Examples:");
      console.log("    npx aisync copy . ../feature-auth");
      console.log("    npx aisync copy ../main ../feature-auth");
      process.exitCode = 1;
      return;
    }
    source = lock.source;
    destination = resolve(".");
  }

  if (!(await exists(source))) {
    log.error(`Source not found: ${source}`);
    process.exitCode = 1;
    return;
  }

  if (!(await isDirectory(source))) {
    log.error(`Source is not a directory: ${source}`);
    process.exitCode = 1;
    return;
  }

  const providers = filterProviders(options.only, options.exclude);
  const scanResults = await scanProviders(source, providers);
  const activeProviders = providers.filter(
    (_, i) => scanResults[i].foundPaths.length > 0,
  );

  const dryLabel = options.dryRun ? " (dry run)" : "";
  log.header(`copy${dryLabel}`);

  console.log(`  Source: ${source}`);
  if (!destArg && !sourceArg) {
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
      await writeLock(destination, source, result.copied);
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
