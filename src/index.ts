import { Command } from "commander";
import { clean } from "./commands/clean.js";
import { completion } from "./commands/completion.js";
import { copy } from "./commands/copy.js";
import { doctor } from "./commands/doctor.js";
import { hookInstall, hookRemove } from "./commands/hook.js";
import { init } from "./commands/init.js";
import { link } from "./commands/link.js";
import { listProviders, listWorktrees } from "./commands/list.js";
import { pull } from "./commands/pull.js";
import { status } from "./commands/status.js";
import { watchCommand } from "./commands/watch.js";
import { runWizard } from "./commands/wizard.js";
import { isTTY } from "./utils/platform.js";

const program = new Command();

program
  .name("aisync")
  .description("Sync AI tool configurations between git worktrees")
  .version("0.10.0");

program
  .command("copy")
  .description("Copy AI configs from source worktree to destination")
  .argument("[source]", "Source worktree path (default: current directory)")
  .argument("[destination]", "Destination worktree path")
  .option("-o, --only <provider...>", "Only sync these providers")
  .option("-e, --exclude <provider...>", "Exclude these providers")
  .option("-d, --dry-run", "Show what would be done without doing it", false)
  .option("-f, --force", "Overwrite existing files in destination", false)
  .option("-v, --verbose", "Show detailed output", false)
  .option("-q, --quiet", "Suppress info output (warn/error only)", false)
  .option("-i, --interactive", "Force interactive provider selection", false)
  .action(copy);

program
  .command("pull")
  .description("Pull AI configs from another worktree into current directory")
  .argument("[source]", "Source worktree path (default: auto-detect)")
  .option("-o, --only <provider...>", "Only sync these providers")
  .option("-e, --exclude <provider...>", "Exclude these providers")
  .option("-d, --dry-run", "Show what would be done without doing it", false)
  .option("-f, --force", "Overwrite existing files in current directory", false)
  .option("-l, --link", "Use symlinks instead of copy", false)
  .option("-v, --verbose", "Show detailed output", false)
  .option("-q, --quiet", "Suppress info output (warn/error only)", false)
  .option("-i, --interactive", "Force interactive provider selection", false)
  .action(pull);

program
  .command("link")
  .description("Symlink AI configs from source worktree to destination")
  .argument("[source]", "Source worktree path (default: current directory)")
  .argument("[destination]", "Destination worktree path")
  .option("-o, --only <provider...>", "Only sync these providers")
  .option("-e, --exclude <provider...>", "Exclude these providers")
  .option("-d, --dry-run", "Show what would be done without doing it", false)
  .option("-f, --force", "Overwrite existing files/links in destination", false)
  .option("-v, --verbose", "Show detailed output", false)
  .option("-q, --quiet", "Suppress info output (warn/error only)", false)
  .option("-i, --interactive", "Force interactive provider selection", false)
  .action(link);

program
  .command("init")
  .description("Bootstrap AI provider configs for the current project")
  .option("-o, --only <provider...>", "Only init these providers")
  .option("-i, --interactive", "Force interactive provider selection", false)
  .option("-q, --quiet", "Suppress info output (warn/error only)", false)
  .action(init);

program
  .command("status")
  .description("Show detected providers and git worktrees")
  .option("-q, --quiet", "Suppress info output (warn/error only)", false)
  .action(status);

const listCmd = program
  .command("list")
  .description("List providers or worktrees");

listCmd
  .command("providers")
  .description("List detected AI providers in current directory")
  .option("-q, --quiet", "Suppress info output (warn/error only)", false)
  .action(listProviders);

listCmd
  .command("worktrees")
  .description("List git worktrees for current repository")
  .option("-q, --quiet", "Suppress info output (warn/error only)", false)
  .action(listWorktrees);

program
  .command("watch")
  .description(
    "Watch all participating worktrees and bidirectionally re-sync on change",
  )
  .argument("[source]", "Source worktree path (default: current directory)")
  .option("-o, --only <provider...>", "Only sync these providers")
  .option("-e, --exclude <provider...>", "Exclude these providers")
  .option("-f, --force", "Overwrite existing files in destinations", false)
  .option("-v, --verbose", "Show detailed output", false)
  .option("-q, --quiet", "Suppress info output (warn/error only)", false)
  .option("--debounce <ms>", "Debounce delay before re-syncing", "200")
  .action(watchCommand);

const hookCmd = program
  .command("hook")
  .description("Manage the git post-checkout hook for auto-sync");

hookCmd
  .command("install")
  .description("Install post-checkout hook")
  .action(() => hookInstall("."));

hookCmd
  .command("remove")
  .description("Remove post-checkout hook")
  .action(() => hookRemove("."));

program
  .command("doctor")
  .description("Diagnose sync state vs aisync-lock.json")
  .option("--json", "Output report as JSON", false)
  .option("-v, --verbose", "Show detailed output", false)
  .option("-q, --quiet", "Suppress info output (warn/error only)", false)
  .action(doctor);

program
  .command("clean")
  .description("Remove synced items and aisync-lock.json from worktree")
  .option("--all", "Clean all worktrees that have a lock file", false)
  .option("-d, --dry-run", "Show what would be removed", false)
  .option("-f, --force", "Skip confirmation prompt", false)
  .option("-v, --verbose", "Show detailed output", false)
  .option("-q, --quiet", "Suppress info output (warn/error only)", false)
  .action(clean);

program
  .command("completion <shell>")
  .description("Output shell completion script (bash|zsh|fish)")
  .action(completion);

if (process.argv.length <= 2 && isTTY()) {
  runWizard().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  program.parse();
}
