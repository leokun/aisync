import { resolve } from "node:path";
import { getWorktrees, isGitRepo } from "../core/git.js";
import { scanProviders } from "../core/scanner.js";
import { providers } from "../providers/registry.js";
import * as log from "../utils/logger.js";

export async function status(): Promise<void> {
  const dir = resolve(".");

  log.header("status");

  console.log(`  Worktree courant: ${dir}`);
  console.log();

  // Scan providers
  const scanResults = await scanProviders(dir, providers);
  console.log("  Detected providers:");
  for (const result of scanResults) {
    if (result.foundPaths.length > 0) {
      log.item(result.provider.name, result.foundPaths.join(" "));
    }
  }

  const hasAny = scanResults.some((r) => r.foundPaths.length > 0);
  if (!hasAny) {
    console.log("    (none)");
  }
  console.log();

  // List worktrees
  if (await isGitRepo(dir)) {
    const worktrees = await getWorktrees(dir);
    console.log("  Git worktrees:");
    for (const wt of worktrees) {
      if (wt.bare) {
        log.item("(bare)", wt.path);
      } else {
        log.item(wt.branch ?? "(detached)", wt.path);
      }
    }
    if (worktrees.length === 0) {
      console.log("    (none)");
    }
  } else {
    console.log("  Not a git repository.");
  }

  console.log();
}
