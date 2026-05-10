import { Command } from "commander";
import { copy } from "./commands/copy.js";
import { hookInstall, hookRemove } from "./commands/hook.js";
import { init } from "./commands/init.js";
import { link } from "./commands/link.js";
import { listProviders, listWorktrees } from "./commands/list.js";
import { status } from "./commands/status.js";
import { watchCommand } from "./commands/watch.js";
import { runWizard } from "./commands/wizard.js";
import { isTTY } from "./utils/platform.js";

const program = new Command();

program
  .name("aisync")
  .description("Sync AI tool configurations between git worktrees")
  .version("0.6.0");

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
  .option("-i, --interactive", "Force interactive provider selection", false)
  .action(copy);

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
  .option("-i, --interactive", "Force interactive provider selection", false)
  .action(link);

program
  .command("init")
  .description("Bootstrap AI provider configs for the current project")
  .option("-o, --only <provider...>", "Only init these providers")
  .option("-i, --interactive", "Force interactive provider selection", false)
  .action(init);

program
  .command("status")
  .description("Show detected providers and git worktrees")
  .action(status);

const listCmd = program
  .command("list")
  .description("List providers or worktrees");

listCmd
  .command("providers")
  .description("List detected AI providers in current directory")
  .action(listProviders);

listCmd
  .command("worktrees")
  .description("List git worktrees for current repository")
  .action(listWorktrees);

program
  .command("watch")
  .description("Watch source worktree and re-sync to other worktrees on change")
  .argument("[source]", "Source worktree path (default: current directory)")
  .option("-o, --only <provider...>", "Only sync these providers")
  .option("-e, --exclude <provider...>", "Exclude these providers")
  .option("-l, --link", "Use symlinks instead of copy", false)
  .option("-f, --force", "Overwrite existing files in destinations", false)
  .option("-v, --verbose", "Show detailed output", false)
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

if (process.argv.length <= 2 && isTTY()) {
  runWizard().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  program.parse();
}
