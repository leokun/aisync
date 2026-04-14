import { execFile } from "node:child_process";
import { resolve } from "node:path";

function exec(command: string, args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

export interface Worktree {
  path: string;
  branch: string | null;
  bare: boolean;
}

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    await exec("git", ["rev-parse", "--git-dir"], cwd);
    return true;
  } catch {
    return false;
  }
}

export async function getWorktrees(cwd: string): Promise<Worktree[]> {
  const output = await exec("git", ["worktree", "list", "--porcelain"], cwd);

  const worktrees: Worktree[] = [];
  let current: Partial<Worktree> = {};

  for (const line of output.split("\n")) {
    if (line.startsWith("worktree ")) {
      current.path = line.slice("worktree ".length);
    } else if (line === "bare") {
      current.bare = true;
    } else if (line.startsWith("branch ")) {
      const ref = line.slice("branch ".length);
      current.branch = ref.replace("refs/heads/", "");
    } else if (line === "") {
      if (current.path) {
        worktrees.push({
          path: current.path,
          branch: current.branch ?? null,
          bare: current.bare ?? false,
        });
      }
      current = {};
    }
  }

  // Handle last entry if no trailing newline
  if (current.path) {
    worktrees.push({
      path: current.path,
      branch: current.branch ?? null,
      bare: current.bare ?? false,
    });
  }

  return worktrees;
}

export async function getRepoRoot(cwd: string): Promise<string> {
  const root = await exec("git", ["rev-parse", "--show-toplevel"], cwd);
  return resolve(root);
}
