import { resolve } from "node:path";
import { readConfig } from "../core/config.js";
import { getRepoRoot, isGitRepo } from "../core/git.js";
import { readSiblingLocks } from "../core/lock.js";
import { scanProviders } from "../core/scanner.js";
import { createBidirectionalWatcher } from "../core/watcher.js";
import { buildProviders, filterProviders } from "../providers/registry.js";
import { exists } from "../utils/fs.js";
import * as log from "../utils/logger.js";

export interface WatchOptions {
  only?: string[];
  exclude?: string[];
  force: boolean;
  verbose: boolean;
  quiet?: boolean;
  debounce: string;
}

export async function watchCommand(
  sourceArg: string | undefined,
  options: WatchOptions,
): Promise<void> {
  log.setVerbose(options.verbose);
  log.setQuiet(options.quiet ?? false);

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
  const siblings = await readSiblingLocks(repoRoot);

  const lockedToSource = siblings.filter(
    (s) =>
      s.lock?.source &&
      resolve(s.lock.source) === source &&
      resolve(s.worktree) !== source,
  );
  const anyLock = siblings.some((s) => s.lock !== null);

  let peers: typeof siblings;
  if (lockedToSource.length > 0) {
    peers = lockedToSource;
  } else if (!anyLock) {
    peers = siblings.filter((s) => resolve(s.worktree) !== source);
  } else {
    peers = [];
  }

  const sourceParticipant = siblings.find(
    (s) => resolve(s.worktree) === source,
  ) ?? { worktree: source, lock: null };

  const participants = [sourceParticipant, ...peers];

  const firstLock = participants.find((p) => p.lock !== null)?.lock;
  const mode: "copy" | "link" = firstLock?.mode ?? "copy";

  log.header(`watch (${mode}, bidirectional)`);
  log.log(`  Source: ${source}`);
  log.log(`  Repo root: ${repoRoot}`);
  log.log(`  Providers: ${activeProviders.map((p) => p.name).join(" ")}`);
  log.log(`  Debounce: ${debounceMs}ms`);
  log.log(
    `  Participants: ${participants.length} (source: ${source}, peers: [${peers
      .map((p) => p.worktree)
      .join(", ")}])`,
  );
  log.log("");

  const watcher = createBidirectionalWatcher({
    participants: participants.map((p) => ({ path: p.worktree, lock: p.lock })),
    providers: activeProviders,
    mode,
    force: options.force,
    debounceMs,
    repoRoot,
  });

  try {
    await watcher.start();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(message);
    process.exitCode = 1;
    return;
  }

  log.success(
    `Watching ${participants.length} participant(s). Ctrl+C to stop.`,
  );
  log.log("");

  const shutdown = (): void => {
    log.log("");
    log.log("  Stopping watchers...");
    watcher.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await new Promise<void>(() => {});
}
