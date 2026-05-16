import { resolve } from "node:path";
import { cancel, isCancel, multiselect, select, text } from "@clack/prompts";
import { findCandidateSources, getWorktrees, isGitRepo } from "../core/git.js";
import * as log from "../utils/logger.js";
import { isTTY } from "../utils/platform.js";
import { copy } from "./copy.js";
import { init } from "./init.js";
import { link } from "./link.js";
import { listProviders, listWorktrees } from "./list.js";
import { pull } from "./pull.js";
import { status } from "./status.js";

type WizardCommand = "copy" | "link" | "pull" | "init" | "status" | "list";

function abortIfCancel<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("Cancelled");
    process.exit(0);
  }
  return value as T;
}

export async function runWizard(): Promise<void> {
  if (!isTTY()) {
    log.error(
      "Interactive mode requires a TTY. Pass a subcommand (copy/link/init/status/list).",
    );
    process.exitCode = 1;
    return;
  }

  log.header("wizard");

  const command = abortIfCancel(
    await select<WizardCommand>({
      message: "What do you want to do?",
      options: [
        {
          label: "copy   - Copy configs to another worktree",
          value: "copy",
        },
        {
          label: "link   - Symlink configs to another worktree",
          value: "link",
        },
        {
          label: "pull   - Pull configs from another worktree to here",
          value: "pull",
        },
        {
          label: "init   - Bootstrap configs for the current project",
          value: "init",
        },
        {
          label: "status - Inspect providers and worktrees",
          value: "status",
        },
        { label: "list   - List providers or worktrees", value: "list" },
      ],
    }),
  );

  if (command === "status") {
    await status();
    return;
  }

  if (command === "init") {
    await init({ interactive: true });
    return;
  }

  if (command === "pull") {
    await runPullWizard();
    return;
  }

  if (command === "list") {
    const target = abortIfCancel(
      await select<"providers" | "worktrees">({
        message: "List what?",
        options: [
          { label: "providers", value: "providers" },
          { label: "worktrees", value: "worktrees" },
        ],
      }),
    );
    if (target === "providers") {
      await listProviders();
    } else {
      await listWorktrees();
    }
    return;
  }

  // copy or link
  await runSyncWizard(command);
}

async function runPullWizard(): Promise<void> {
  const cwd = resolve(".");

  let candidates: Awaited<ReturnType<typeof findCandidateSources>> = [];
  if (await isGitRepo(cwd)) {
    try {
      candidates = await findCandidateSources(cwd);
    } catch {
      candidates = [];
    }
  }

  const MANUAL = "__manual__";
  let chosen: string;

  if (candidates.length === 0) {
    chosen = abortIfCancel(
      await text({
        message: "Source worktree path?",
        placeholder: "../main",
        validate: (value) => {
          if (!value || value.trim().length === 0) {
            return "Enter a source path";
          }
        },
      }),
    );
  } else {
    const picked = abortIfCancel(
      await select<string>({
        message: "Pull from which worktree?",
        options: [
          ...candidates.map((c) => ({
            label: c.branch ? `${c.path} (${c.branch})` : c.path,
            value: c.path,
          })),
          { label: "Enter a path manually...", value: MANUAL },
        ],
      }),
    );

    if (picked === MANUAL) {
      chosen = abortIfCancel(
        await text({
          message: "Source worktree path?",
          placeholder: "../main",
          validate: (value) => {
            if (!value || value.trim().length === 0) {
              return "Enter a source path";
            }
          },
        }),
      );
    } else {
      chosen = picked;
    }
  }

  const mode = abortIfCancel(
    await select<"copy" | "link">({
      message: "Pull using copy or symlink?",
      options: [
        { label: "copy  - Duplicate files", value: "copy" },
        { label: "link  - Symlink from source", value: "link" },
      ],
    }),
  );

  await pull(chosen, {
    dryRun: false,
    force: false,
    verbose: false,
    interactive: true,
    link: mode === "link",
  });
}

async function runSyncWizard(command: "copy" | "link"): Promise<void> {
  const cwd = resolve(".");
  const source = abortIfCancel(
    await text({
      message: "Source (worktree to sync from)?",
      placeholder: ".",
      defaultValue: ".",
    }),
  );
  const sourceResolved = resolve(source);

  const destinations = await pickDestinations(cwd, sourceResolved);
  if (destinations.length === 0) {
    log.warn("No destination selected.");
    return;
  }

  for (const destination of destinations) {
    const options = {
      dryRun: false,
      force: false,
      verbose: false,
      interactive: true,
    };
    if (command === "copy") {
      await copy(source, destination, options);
    } else {
      await link(source, destination, options);
    }
  }
}

async function pickDestinations(
  cwd: string,
  sourceResolved: string,
): Promise<string[]> {
  const worktrees = await listWorktreeChoices(cwd, sourceResolved);

  if (worktrees.length > 0) {
    const picked = abortIfCancel(
      await multiselect<string>({
        message: "Destinations? (space to toggle)",
        options: [
          ...worktrees.map((w) => ({
            label: w.branch ? `${w.path} (${w.branch})` : w.path,
            value: w.path,
          })),
          { label: "Enter a path manually...", value: "__manual__" },
        ],
        required: true,
      }),
    );

    const result = picked.filter((p) => p !== "__manual__");
    if (picked.includes("__manual__")) {
      const extra = await promptManualDestinations();
      result.push(...extra);
    }
    return result;
  }

  return promptManualDestinations();
}

async function promptManualDestinations(): Promise<string[]> {
  const raw = abortIfCancel(
    await text({
      message: "Destination path(s) (comma-separated)",
      placeholder: "../feature-branch",
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return "Enter at least one destination";
        }
      },
    }),
  );
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function listWorktreeChoices(
  cwd: string,
  sourceResolved: string,
): Promise<{ path: string; branch: string | null }[]> {
  if (!(await isGitRepo(cwd))) return [];
  try {
    const worktrees = await getWorktrees(cwd);
    return worktrees
      .filter((w) => !w.bare && resolve(w.path) !== sourceResolved)
      .map((w) => ({ path: w.path, branch: w.branch }));
  } catch {
    return [];
  }
}
