import { resolve } from "node:path";
import { cancel, confirm, isCancel } from "@clack/prompts";
import {
  CleanError,
  type CleanResult,
  cleanWorktree,
} from "../core/cleaner.js";
import { getWorktrees, isGitRepo } from "../core/git.js";
import { readLock } from "../core/lock.js";
import * as log from "../utils/logger.js";
import { isTTY } from "../utils/platform.js";

interface CleanOptions {
  all?: boolean;
  dryRun?: boolean;
  force?: boolean;
  verbose?: boolean;
  quiet?: boolean;
}

export async function clean(options: CleanOptions): Promise<void> {
  log.setVerbose(Boolean(options.verbose));
  log.setQuiet(Boolean(options.quiet));

  const cwd = resolve(".");
  const targets = options.all ? await collectAllTargets(cwd) : [cwd];

  if (targets.length === 0) {
    log.warn("No worktree with aisync-lock.json found.");
    return;
  }

  const dryLabel = options.dryRun ? " (dry run)" : "";
  log.header(`clean${dryLabel}`);

  for (const t of targets) {
    log.log(`  Target: ${t}`);
  }
  log.log("");

  if (!options.dryRun && !options.force) {
    const confirmed = await confirmCleanup(targets.length);
    if (!confirmed) return;
  }

  let totalRemoved = 0;
  for (const target of targets) {
    try {
      const result = await cleanWorktree(target, {
        dryRun: Boolean(options.dryRun),
      });
      printResult(result, Boolean(options.dryRun));
      totalRemoved += result.removed.length;
    } catch (err) {
      if (err instanceof CleanError) {
        log.warn(err.message);
        continue;
      }
      throw err;
    }
  }

  log.log("");
  if (options.dryRun) {
    log.log(`  Would remove ${totalRemoved} item(s). No changes made.`);
  } else {
    log.success(`${totalRemoved} item(s) removed`);
  }
  log.log("");
}

async function collectAllTargets(cwd: string): Promise<string[]> {
  if (!(await isGitRepo(cwd))) {
    log.error("--all requires a git repository.");
    process.exitCode = 1;
    return [];
  }
  const worktrees = await getWorktrees(cwd);
  const targets: string[] = [];
  for (const wt of worktrees) {
    if (wt.bare) continue;
    if (await readLock(wt.path)) {
      targets.push(wt.path);
    }
  }
  return targets;
}

async function confirmCleanup(count: number): Promise<boolean> {
  if (!isTTY()) {
    log.error(
      "Confirmation required (no TTY). Pass --force to skip, or --dry-run to preview.",
    );
    process.exitCode = 1;
    return false;
  }
  const message =
    count > 1
      ? `Remove synced items and lock from ${count} worktrees?`
      : "Remove synced items and aisync-lock.json?";
  const answer = await confirm({ message, initialValue: false });
  if (isCancel(answer)) {
    cancel("Cancelled");
    return false;
  }
  if (!answer) {
    log.warn("Aborted.");
    return false;
  }
  return true;
}

function printResult(result: CleanResult, dryRun: boolean): void {
  log.log(`  ${result.destination}`);
  if (result.removed.length === 0 && !result.lockRemoved) {
    log.item("(nothing to remove)", "");
  }
  for (const path of result.removed) {
    log.item(path, dryRun ? "would remove" : "✓ removed");
  }
  for (const path of result.notFound) {
    log.item(path, "(not found, already gone)");
  }
  if (result.lockRemoved) {
    log.item("aisync-lock.json", dryRun ? "would remove" : "✓ removed");
  }
  log.log("");
}
