import { type FSWatcher, watch } from "node:fs";
import { join, resolve } from "node:path";
import type { Provider } from "../providers/registry.js";
import { exists } from "../utils/fs.js";
import { hashItem } from "../utils/hash.js";
import * as log from "../utils/logger.js";
import { copyProviders } from "./copier.js";
import { linkProviders } from "./linker.js";
import { type LockFile, readLock, writeLock } from "./lock.js";

export interface Participant {
  path: string;
  lock: LockFile | null;
}

export interface BidirectionalWatcherOptions {
  participants: Participant[];
  providers: Provider[];
  mode: "copy" | "link";
  force: boolean;
  debounceMs: number;
  repoRoot: string;
}

export interface BidirectionalWatcher {
  start(): Promise<void>;
  stop(): void;
}

export function createBidirectionalWatcher(
  options: BidirectionalWatcherOptions,
): BidirectionalWatcher {
  const { participants, providers, mode, debounceMs } = options;

  const inFlightWrites = new Set<string>();
  const graceMs = Math.max(500, 2 * debounceMs);
  const watchers: FSWatcher[] = [];
  const debounceTimers = new Map<string, NodeJS.Timeout>();
  const syncingOrigins = new Set<string>();
  const pendingOrigins = new Set<string>();

  function markInFlight(absPath: string): void {
    inFlightWrites.add(resolve(absPath));
  }

  function clearInFlight(absPath: string): void {
    const resolved = resolve(absPath);
    setTimeout(() => {
      inFlightWrites.delete(resolved);
    }, graceMs);
  }

  function scheduleSync(origin: string): void {
    const existing = debounceTimers.get(origin);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      debounceTimers.delete(origin);
      void runSync(origin);
    }, debounceMs);
    debounceTimers.set(origin, timer);
  }

  async function runSync(origin: string): Promise<void> {
    if (syncingOrigins.has(origin)) {
      pendingOrigins.add(origin);
      return;
    }
    syncingOrigins.add(origin);
    try {
      await propagate(origin);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error(`Sync from ${origin} failed: ${message}`);
    } finally {
      syncingOrigins.delete(origin);
      if (pendingOrigins.has(origin)) {
        pendingOrigins.delete(origin);
        scheduleSync(origin);
      }
    }
  }

  async function propagate(origin: string): Promise<void> {
    const peers = participants.filter(
      (p) => resolve(p.path) !== resolve(origin),
    );
    if (peers.length === 0) return;

    const stamp = new Date().toLocaleTimeString();
    log.log(
      `  [${stamp}] change in ${origin}, syncing to ${peers.length} peer(s)`,
    );

    const writeOpts = {
      onBeforeWrite: markInFlight,
      onAfterWrite: clearInFlight,
    };

    let originItems: Array<{
      path: string;
      type: "file" | "directory";
      provider: string;
      hash?: string;
      target?: string;
    }> = [];

    for (const peer of peers) {
      try {
        if (mode === "copy") {
          const result = await copyProviders(origin, peer.path, providers, {
            force: true,
            dryRun: false,
            ...writeOpts,
          });
          if (result.copied.length > 0) {
            await writeLock(peer.path, origin, result.copied, "copy");
            originItems = result.copied;
          }
          log.item(
            peer.path,
            `${result.copied.length} copied, ${result.skipped.length} skipped`,
          );
        } else {
          const result = await linkProviders(origin, peer.path, providers, {
            force: true,
            dryRun: false,
            ...writeOpts,
          });
          if (result.linked.length > 0) {
            await writeLock(peer.path, origin, result.linked, "link");
            originItems = result.linked;
          }
          log.item(
            peer.path,
            `${result.linked.length} linked, ${result.skipped.length} skipped`,
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.warn(`${peer.path}: ${message}`);
      }
    }

    if (mode === "copy" && originItems.length > 0) {
      const originParticipant = participants.find(
        (p) => resolve(p.path) === resolve(origin),
      );
      if (originParticipant) {
        const copyItems = originItems
          .filter((i) => i.hash)
          .map((i) => ({
            path: i.path,
            type: i.type,
            provider: i.provider,
            hash: i.hash as string,
          }));
        await writeLock(origin, origin, copyItems, "copy");
        originParticipant.lock = await readLock(origin);
      }
    }

    log.log("");
  }

  async function shouldSkipEvent(
    origin: string,
    relPath: string,
  ): Promise<boolean> {
    const absPath = join(origin, relPath);
    if (inFlightWrites.has(resolve(absPath))) return true;
    if (!(await exists(absPath))) return false;

    const participant = participants.find(
      (p) => resolve(p.path) === resolve(origin),
    );
    const lockEntry = participant?.lock?.items.find(
      (item) =>
        relPath === item.path ||
        relPath.startsWith(`${item.path.replace(/\/$/, "")}/`),
    );
    if (!lockEntry?.hash) return false;

    try {
      const computed = await hashItem(join(origin, lockEntry.path));
      return computed === lockEntry.hash;
    } catch {
      return false;
    }
  }

  async function attachWatchers(): Promise<void> {
    const seen = new Set<string>();
    for (const participant of participants) {
      for (const provider of providers) {
        for (const relativePath of provider.paths) {
          const absPath = join(participant.path, relativePath);
          if (!(await exists(absPath))) continue;
          const key = `${participant.path}::${absPath}`;
          if (seen.has(key)) continue;
          seen.add(key);

          try {
            const watcher = watch(absPath, { recursive: true }, (_e, fname) => {
              const relName = fname ? String(fname) : "";
              const evtRelPath = relName
                ? join(relativePath.replace(/\/$/, ""), relName)
                : relativePath;
              void (async () => {
                if (await shouldSkipEvent(participant.path, evtRelPath)) return;
                scheduleSync(participant.path);
              })();
            });
            watcher.on("error", (err: Error) => {
              log.warn(
                `Watcher error on ${participant.path}/${relativePath}: ${err.message}`,
              );
            });
            watchers.push(watcher);
            log.verbose(`watching ${participant.path}/${relativePath}`);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            log.warn(
              `Failed to watch ${participant.path}/${relativePath}: ${message}`,
            );
          }
        }
      }
    }
  }

  async function start(): Promise<void> {
    await attachWatchers();
    if (watchers.length === 0) {
      throw new Error("No paths to watch.");
    }
    const seed = participants[0];
    if (seed) await runSync(seed.path);
  }

  function stop(): void {
    for (const w of watchers) {
      w.close();
    }
    for (const t of debounceTimers.values()) {
      clearTimeout(t);
    }
    debounceTimers.clear();
  }

  return { start, stop };
}
