import { watch } from "node:fs";
import { join, resolve } from "node:path";
import { readConfig } from "../core/config.js";
import { copyProviders } from "../core/copier.js";
import { getRepoRoot, getWorktrees, isGitRepo } from "../core/git.js";
import { linkProviders } from "../core/linker.js";
import { writeLock } from "../core/lock.js";
import { scanProviders } from "../core/scanner.js";
import { buildProviders, filterProviders } from "../providers/registry.js";
import { exists } from "../utils/fs.js";
import * as log from "../utils/logger.js";

export interface WatchOptions {
  only?: string[];
  exclude?: string[];
  link: boolean;
  force: boolean;
  verbose: boolean;
  debounce: string;
}

export async function watchCommand(
  sourceArg: string | undefined,
  options: WatchOptions,
): Promise<void> {
  log.setVerbose(options.verbose);

  const config = await readConfig(".");
  const registry = buildProviders(config?.providers);

  const source = resolve(sourceArg ?? config?.source ?? ".");

  if (!(await exists(source))) {
    log.error(`Source not found: ${source}`);
    process.exitCode = 1;
    return;
  }

  if (!(await isGitRepo(source))) {
    log.error(`Source is not a git repository: ${source}`);
    process.exitCode = 1;
    return;
  }

  const only = options.only ?? config?.only;
  const exclude = options.exclude ?? config?.exclude;
  const providers = filterProviders(only, exclude, registry);
  const scanResults = await scanProviders(source, providers);
  const activeProviders = providers.filter(
    (_, i) => scanResults[i].foundPaths.length > 0,
  );

  if (activeProviders.length === 0) {
    log.warn("No providers found in source directory.");
    return;
  }

  const debounceMs = Number.parseInt(options.debounce, 10);
  if (!Number.isFinite(debounceMs) || debounceMs < 0) {
    log.error(`Invalid --debounce value: ${options.debounce}`);
    process.exitCode = 1;
    return;
  }

  const repoRoot = await getRepoRoot(source);
  const mode = options.link ? "link" : "copy";

  log.header(`watch (${mode})`);
  console.log(`  Source: ${source}`);
  console.log(`  Repo root: ${repoRoot}`);
  console.log(`  Providers: ${activeProviders.map((p) => p.name).join(" ")}`);
  console.log(`  Debounce: ${debounceMs}ms`);
  console.log();

  const watchedPaths = new Set<string>();
  const watchers: ReturnType<typeof watch>[] = [];

  for (const provider of activeProviders) {
    for (const relativePath of provider.paths) {
      const absPath = join(source, relativePath);
      if (!(await exists(absPath))) continue;
      if (watchedPaths.has(absPath)) continue;
      watchedPaths.add(absPath);

      try {
        const watcher = watch(absPath, { recursive: true }, () =>
          scheduleSync(),
        );
        watcher.on("error", (err: Error) => {
          log.warn(`Watcher error on ${relativePath}: ${err.message}`);
        });
        watchers.push(watcher);
        log.verbose(`watching ${relativePath}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.warn(`Failed to watch ${relativePath}: ${message}`);
      }
    }
  }

  if (watchers.length === 0) {
    log.error("No paths to watch.");
    process.exitCode = 1;
    return;
  }

  let timer: NodeJS.Timeout | null = null;
  let syncing = false;
  let pending = false;

  function scheduleSync(): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void runSync();
    }, debounceMs);
  }

  async function runSync(): Promise<void> {
    if (syncing) {
      pending = true;
      return;
    }
    syncing = true;
    try {
      await syncToWorktrees(
        source,
        repoRoot,
        activeProviders,
        mode,
        options.force,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error(`Sync failed: ${message}`);
    } finally {
      syncing = false;
      if (pending) {
        pending = false;
        scheduleSync();
      }
    }
  }

  log.success(`Watching ${watchers.length} path(s). Ctrl+C to stop.`);
  console.log();

  const shutdown = (): void => {
    console.log();
    log.log("  Stopping watchers...");
    for (const w of watchers) {
      w.close();
    }
    if (timer) clearTimeout(timer);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await new Promise<void>(() => {});
}

async function syncToWorktrees(
  source: string,
  repoRoot: string,
  providers: ReturnType<typeof buildProviders>,
  mode: "copy" | "link",
  force: boolean,
): Promise<void> {
  const worktrees = await getWorktrees(repoRoot);
  const targets = worktrees.filter(
    (w) => !w.bare && resolve(w.path) !== source,
  );

  if (targets.length === 0) {
    log.warn("No other worktrees to sync to.");
    return;
  }

  const stamp = new Date().toLocaleTimeString();
  console.log(
    `  [${stamp}] change detected, syncing to ${targets.length} worktree(s)`,
  );

  for (const target of targets) {
    const dest = resolve(target.path);
    try {
      if (mode === "copy") {
        const result = await copyProviders(source, dest, providers, {
          force,
          dryRun: false,
        });
        if (result.copied.length > 0) {
          await writeLock(dest, source, result.copied, "copy");
        }
        log.item(
          target.path,
          `${result.copied.length} copied, ${result.skipped.length} skipped`,
        );
      } else {
        const result = await linkProviders(source, dest, providers, {
          force,
          dryRun: false,
        });
        if (result.linked.length > 0) {
          await writeLock(dest, source, result.linked, "link");
        }
        log.item(
          target.path,
          `${result.linked.length} linked, ${result.skipped.length} skipped`,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.warn(`${target.path}: ${message}`);
    }
  }
  console.log();
}
