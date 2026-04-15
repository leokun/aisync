import { Command } from "commander";
import { copy } from "./commands/copy.js";
import { init } from "./commands/init.js";
import { link } from "./commands/link.js";
import { listProviders, listWorktrees } from "./commands/list.js";
import { status } from "./commands/status.js";

const program = new Command();

program
  .name("aisync")
  .description("Sync AI tool configurations between git worktrees")
  .version("0.2.0");

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
  .action(link);

program
  .command("init")
  .description("Bootstrap AI provider configs for the current project")
  .option("-o, --only <provider...>", "Only init these providers")
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

program.parse();
