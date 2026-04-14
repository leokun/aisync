import { resolve } from "node:path";
import { getWorktrees, isGitRepo } from "../core/git.js";
import { scanProviders } from "../core/scanner.js";
import { providers } from "../providers/registry.js";
import * as log from "../utils/logger.js";

export async function listProviders(): Promise<void> {
  const dir = resolve(".");
  const scanResults = await scanProviders(dir, providers);

  log.header("providers");

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
}

export async function listWorktrees(): Promise<void> {
  const dir = resolve(".");

  log.header("worktrees");

  if (!(await isGitRepo(dir))) {
    log.error("Not a git repository.");
    process.exitCode = 1;
    return;
  }

  const worktrees = await getWorktrees(dir);
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
  console.log();
}
