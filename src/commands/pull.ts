import { resolve } from "node:path";
import { cancel, isCancel, select } from "@clack/prompts";
import { readConfig } from "../core/config.js";
import { copyProviders } from "../core/copier.js";
import { findCandidateSources } from "../core/git.js";
import { linkProviders } from "../core/linker.js";
import { readLock, writeLock } from "../core/lock.js";
import { scanProviders } from "../core/scanner.js";
import { buildProviders, filterProviders } from "../providers/registry.js";
import * as log from "../utils/logger.js";
import { isTTY } from "../utils/platform.js";
import { selectProviders } from "../utils/prompt.js";
import { type SyncOptions, validateSource } from "./sync.js";

async function resolvePullSource(
  sourceArg: string | undefined,
  cwd: string,
  _configSource: string | undefined,
): Promise<string | null> {
  if (sourceArg) {
    return resolve(sourceArg);
  }

  const lock = await readLock(cwd);
  if (lock) {
    return lock.source;
  }

  let candidates: Awaited<ReturnType<typeof findCandidateSources>>;
  try {
    candidates = await findCandidateSources(cwd);
  } catch {
    candidates = [];
  }

  if (candidates.length === 0) {
    log.error(
      "No source specified and no other worktrees found. Pass a source path: aisync pull <source>",
    );
    process.exitCode = 1;
    return null;
  }

  if (candidates.length === 1) {
    const picked = candidates[0].path;
    log.log(`Auto-detected source: ${picked}`);
    return resolve(picked);
  }

  if (!isTTY()) {
    log.error(
      "Multiple candidate sources found; specify one explicitly: aisync pull <source>",
    );
    log.log("");
    log.log("  Candidates:");
    for (const c of candidates) {
      log.log(`    ${c.path}${c.branch ? ` (${c.branch})` : ""}`);
    }
    process.exitCode = 1;
    return null;
  }

  const picked = await select<string>({
    message: "Pull from which worktree?",
    options: candidates.map((c) => ({
      label: c.branch ? `${c.path} (${c.branch})` : c.path,
      value: c.path,
    })),
  });

  if (isCancel(picked)) {
    cancel("Cancelled");
    process.exit(0);
  }

  return resolve(picked);
}

export async function pull(
  sourceArg: string | undefined,
  options: SyncOptions,
): Promise<void> {
  log.setVerbose(options.verbose);
  log.setQuiet(options.quiet ?? false);

  const cwd = resolve(".");
  const config = await readConfig(".");
  const registry = buildProviders(config?.providers);

  const source = await resolvePullSource(sourceArg, cwd, config?.source);
  if (!source) return;

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
  const modeLabel = options.link ? " (link)" : "";
  log.header(`pull${modeLabel}${dryLabel}`);

  log.log(`  Source: ${source}`);
  log.log(`  Destination: ${cwd}`);
  log.log(
    `  Providers: ${activeProviders.map((p) => p.name).join(" ") || "none found"}`,
  );
  log.log("");

  if (activeProviders.length === 0) {
    log.warn("No providers found in source directory.");
    return;
  }

  if (options.link) {
    const result = await linkProviders(source, cwd, activeProviders, {
      force: options.force,
      dryRun: options.dryRun,
    });

    if (options.dryRun) {
      log.log("  Would link:");
      for (const item of result.linked) {
        log.item(item.path, `(${item.type})`);
      }
      for (const path of result.skipped) {
        log.item(path, "(exists, use --force to overwrite)");
      }
      log.log("");
      log.log("  No changes made. Remove --dry-run to apply.");
    } else {
      log.log("  Linking...");
      for (const item of result.linked) {
        log.item(item.path, "✓");
      }
      for (const path of result.skipped) {
        log.item(path, "skipped (exists, use --force)");
      }

      if (result.linked.length > 0) {
        await writeLock(cwd, source, result.linked, "link");
      }

      log.log("");
      log.success(`${result.linked.length} item(s) linked`);
      if (result.skipped.length > 0) {
        log.warn(`${result.skipped.length} item(s) skipped`);
      }
      if (result.linked.length > 0) {
        log.success("aisync-lock.json written");
      }
    }
  } else {
    const existingLock = await readLock(cwd);
    const result = await copyProviders(source, cwd, activeProviders, {
      force: options.force,
      dryRun: options.dryRun,
      lock: existingLock,
    });

    if (options.dryRun) {
      log.log("  Would copy:");
      for (const item of result.copied) {
        log.item(item.path, `(${item.type})`);
      }
      for (const path of result.drifted) {
        log.item(path, "(drift, use --force to overwrite)");
      }
      for (const path of result.skipped) {
        log.item(path, "(exists, use --force to overwrite)");
      }
      log.log("");
      log.log("  No changes made. Remove --dry-run to apply.");
    } else {
      log.log("  Pulling...");
      for (const item of result.copied) {
        log.item(item.path, "✓");
      }
      for (const path of result.drifted) {
        log.item(path, "drift (local edits, use --force to overwrite)");
      }
      for (const path of result.skipped) {
        log.item(path, "skipped (exists, use --force)");
      }

      if (result.copied.length > 0) {
        await writeLock(cwd, source, result.copied, "copy");
      }

      log.log("");
      log.success(`${result.copied.length} item(s) pulled`);
      if (result.drifted.length > 0) {
        log.warn(
          `${result.drifted.length} item(s) have local edits (drift) - use --force to overwrite`,
        );
      }
      if (result.skipped.length > 0) {
        log.warn(`${result.skipped.length} item(s) skipped`);
      }
      if (result.copied.length > 0) {
        log.success("aisync-lock.json written");
      }
    }
  }

  log.log("");
  log.log("  Done!");
  log.log("");
}
