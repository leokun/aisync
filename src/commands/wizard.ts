import { resolve } from "node:path";
import { cancel, isCancel, multiselect, select, text } from "@clack/prompts";
import { getWorktrees, isGitRepo } from "../core/git.js";
import * as log from "../utils/logger.js";
import { isTTY } from "../utils/platform.js";
import { copy } from "./copy.js";
import { init } from "./init.js";
import { link } from "./link.js";
import { listProviders, listWorktrees } from "./list.js";
import { status } from "./status.js";

type WizardCommand = "copy" | "link" | "init" | "status" | "list";

function abortIfCancel<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("Annulé");
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
      message: "Que veux-tu faire ?",
      options: [
        {
          label: "copy   - Copier les configs vers un autre worktree",
          value: "copy",
        },
        {
          label: "link   - Symlinker les configs vers un autre worktree",
          value: "link",
        },
        {
          label: "init   - Bootstrapper les configs du projet courant",
          value: "init",
        },
        {
          label: "status - Inspecter les providers et worktrees",
          value: "status",
        },
        { label: "list   - Lister providers ou worktrees", value: "list" },
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

  if (command === "list") {
    const target = abortIfCancel(
      await select<"providers" | "worktrees">({
        message: "Lister quoi ?",
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

async function runSyncWizard(command: "copy" | "link"): Promise<void> {
  const cwd = resolve(".");
  const source = abortIfCancel(
    await text({
      message: "Source (worktree à synchroniser depuis) ?",
      placeholder: ".",
      defaultValue: ".",
    }),
  );
  const sourceResolved = resolve(source);

  const destinations = await pickDestinations(cwd, sourceResolved);
  if (destinations.length === 0) {
    log.warn("Aucune destination sélectionnée.");
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
        message: "Destinations ? (espace pour cocher)",
        options: [
          ...worktrees.map((w) => ({
            label: w.branch ? `${w.path} (${w.branch})` : w.path,
            value: w.path,
          })),
          { label: "Saisir un chemin manuellement…", value: "__manual__" },
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
      message: "Chemin(s) de destination (séparés par des virgules)",
      placeholder: "../feature-branch",
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return "Saisis au moins une destination";
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
