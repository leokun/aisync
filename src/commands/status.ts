import { resolve } from "node:path";
import { readConfig } from "../core/config.js";
import { getWorktrees, isGitRepo } from "../core/git.js";
import { scanProviders } from "../core/scanner.js";
import { buildProviders } from "../providers/registry.js";
import * as log from "../utils/logger.js";

interface StatusOptions {
  quiet?: boolean;
}

export async function status(options: StatusOptions = {}): Promise<void> {
  log.setQuiet(options.quiet ?? false);
  const dir = resolve(".");
  const config = await readConfig(dir);
  const providers = buildProviders(config?.providers);

  log.header("status");

  log.log(`  Worktree courant: ${dir}`);
  log.log("");

  // Scan providers
  const scanResults = await scanProviders(dir, providers);
  log.log("  Detected providers:");
  for (const result of scanResults) {
    if (result.foundPaths.length > 0) {
      log.item(result.provider.name, result.foundPaths.join(" "));
    }
  }

  const hasAny = scanResults.some((r) => r.foundPaths.length > 0);
  if (!hasAny) {
    log.log("    (none)");
  }
  log.log("");

  // List worktrees
  if (await isGitRepo(dir)) {
    const worktrees = await getWorktrees(dir);
    log.log("  Git worktrees:");
    for (const wt of worktrees) {
      if (wt.bare) {
        log.item("(bare)", wt.path);
      } else {
        log.item(wt.branch ?? "(detached)", wt.path);
      }
    }
    if (worktrees.length === 0) {
      log.log("    (none)");
    }
  } else {
    log.log("  Not a git repository.");
  }

  log.log("");
}
