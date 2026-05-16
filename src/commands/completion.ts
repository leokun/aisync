import { getProviderNames } from "../providers/registry.js";

const SHELLS = ["bash", "zsh", "fish"] as const;
type Shell = (typeof SHELLS)[number];

const COMMANDS = [
  "copy",
  "pull",
  "link",
  "init",
  "status",
  "list",
  "watch",
  "hook",
  "doctor",
  "clean",
  "completion",
] as const;

const SUBCOMMANDS: Record<string, string[]> = {
  list: ["providers", "worktrees"],
  hook: ["install", "remove"],
  completion: ["bash", "zsh", "fish"],
};

const COMMAND_DESCRIPTIONS: Record<string, string> = {
  copy: "Copy AI configs from source worktree to destination",
  pull: "Pull AI configs from another worktree into current directory",
  link: "Symlink AI configs from source worktree to destination",
  init: "Bootstrap AI provider configs for the current project",
  status: "Show detected providers and git worktrees",
  list: "List providers or worktrees",
  watch: "Watch source worktree and re-sync on change",
  hook: "Manage the git post-checkout hook",
  doctor: "Diagnose sync state vs aisync-lock.json",
  clean: "Remove synced items and aisync-lock.json",
  completion: "Output shell completion script",
};

const SYNC_FLAGS = [
  "--only",
  "-o",
  "--exclude",
  "-e",
  "--dry-run",
  "-d",
  "--force",
  "-f",
  "--verbose",
  "-v",
  "--quiet",
  "-q",
  "--interactive",
  "-i",
];

const FLAGS_BY_COMMAND: Record<string, string[]> = {
  copy: SYNC_FLAGS,
  pull: [...SYNC_FLAGS, "--link", "-l"],
  link: SYNC_FLAGS,
  watch: [
    "--only",
    "-o",
    "--exclude",
    "-e",
    "--link",
    "-l",
    "--force",
    "-f",
    "--verbose",
    "-v",
    "--quiet",
    "-q",
    "--debounce",
  ],
  init: ["--only", "-o", "--interactive", "-i", "--quiet", "-q"],
  status: ["--quiet", "-q"],
  list: ["--quiet", "-q"],
  hook: ["--quiet", "-q"],
  doctor: ["--json", "--verbose", "-v", "--quiet", "-q"],
  clean: [
    "--all",
    "--dry-run",
    "-d",
    "--force",
    "-f",
    "--verbose",
    "-v",
    "--quiet",
    "-q",
  ],
  completion: [],
};

const DIR_ARG_COMMANDS = new Set(["copy", "pull", "link", "watch"]);

export function completion(shell: string): void {
  if (!isShell(shell)) {
    process.stderr.write(
      `aisync: unsupported shell "${shell}" (supported: ${SHELLS.join(", ")})\n`,
    );
    process.exit(1);
  }

  const providers = getProviderNames();
  const script =
    shell === "bash"
      ? bashScript(providers)
      : shell === "zsh"
        ? zshScript(providers)
        : fishScript(providers);

  process.stdout.write(script);
}

function isShell(value: string): value is Shell {
  return (SHELLS as readonly string[]).includes(value);
}

function bashScript(providers: string[]): string {
  const cmds = COMMANDS.join(" ");
  const provs = providers.join(" ");
  const dirCmds = [...DIR_ARG_COMMANDS].join("|");

  const caseArms = Object.entries(FLAGS_BY_COMMAND)
    .filter(([, flags]) => flags.length > 0)
    .map(
      ([cmd, flags]) =>
        `      ${cmd}) COMPREPLY=( $(compgen -W "${flags.join(" ")} ${(SUBCOMMANDS[cmd] ?? []).join(" ")}" -- "$cur") ); return ;;`,
    )
    .join("\n");

  return `# aisync bash completion
_aisync() {
  local cur prev words cword
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  # Value completion based on previous token
  case "$prev" in
    --only|-o|--exclude|-e)
      COMPREPLY=( $(compgen -W "${provs}" -- "$cur") )
      return ;;
    --debounce)
      return ;;
    list)
      COMPREPLY=( $(compgen -W "${(SUBCOMMANDS.list ?? []).join(" ")}" -- "$cur") )
      return ;;
    hook)
      COMPREPLY=( $(compgen -W "${(SUBCOMMANDS.hook ?? []).join(" ")}" -- "$cur") )
      return ;;
    completion)
      COMPREPLY=( $(compgen -W "${(SUBCOMMANDS.completion ?? []).join(" ")}" -- "$cur") )
      return ;;
    ${dirCmds})
      COMPREPLY=( $(compgen -d -- "$cur") )
      return ;;
  esac

  # Flag completion when current token starts with -
  if [[ "$cur" == -* ]]; then
    local cmd=""
    for ((i=1; i<COMP_CWORD; i++)); do
      case "\${COMP_WORDS[i]}" in
        ${COMMANDS.map((c) => `${c}) cmd="${c}"; break ;;`).join("\n        ")}
      esac
    done
    case "$cmd" in
${caseArms}
    esac
    return
  fi

  # Default: top-level commands
  if [[ $COMP_CWORD -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "${cmds}" -- "$cur") )
    return
  fi

  # Fallback: directory completion
  COMPREPLY=( $(compgen -d -- "$cur") )
}
complete -F _aisync aisync
`;
}

function zshScript(providers: string[]): string {
  const cmdLines = COMMANDS.map(
    (c) => `    '${c}:${COMMAND_DESCRIPTIONS[c] ?? ""}'`,
  ).join("\n");

  const perCommandFns = COMMANDS.filter(
    (c) => FLAGS_BY_COMMAND[c]?.length || SUBCOMMANDS[c],
  )
    .map((cmd) => {
      const flags = FLAGS_BY_COMMAND[cmd] ?? [];
      const flagArgs = flags
        .filter((f) => f.startsWith("--") || f.length === 2)
        .map((f) => {
          if (f === "--only" || f === "-o") {
            return `    '(-o --only)'{-o,--only}'[Only sync these providers]:provider:(${providers.join(" ")})'`;
          }
          if (f === "--exclude" || f === "-e") {
            return `    '(-e --exclude)'{-e,--exclude}'[Exclude these providers]:provider:(${providers.join(" ")})'`;
          }
          if (f === "--debounce") {
            return `    '--debounce[Debounce delay before re-syncing]:ms:'`;
          }
          if (f.startsWith("--")) {
            return `    '${f}[${flagDescription(f)}]'`;
          }
          return null;
        })
        .filter((line): line is string => line !== null);

      const subs = SUBCOMMANDS[cmd];
      const subArg = subs
        ? `    '1:subcommand:(${subs.join(" ")})'`
        : DIR_ARG_COMMANDS.has(cmd)
          ? `    '*:path:_files -/'`
          : "";

      const body = [...flagArgs, subArg].filter(Boolean).join(" \\\n");

      return `_aisync_${cmd}() {
  _arguments \\
${body || "    ':: :_files'"}
}`;
    })
    .join("\n\n");

  return `#compdef aisync
# aisync zsh completion

_aisync() {
  local context state state_descr line
  typeset -A opt_args

  _arguments -C \\
    '1: :_aisync_commands' \\
    '*::arg:->args'

  case $state in
    args)
      case $words[1] in
${COMMANDS.filter((c) => FLAGS_BY_COMMAND[c]?.length || SUBCOMMANDS[c])
  .map((c) => `        ${c}) _aisync_${c} ;;`)
  .join("\n")}
      esac
      ;;
  esac
}

_aisync_commands() {
  local commands
  commands=(
${cmdLines}
  )
  _describe 'command' commands
}

${perCommandFns}

_aisync "$@"
`;
}

function fishScript(providers: string[]): string {
  const lines: string[] = [
    "# aisync fish completion",
    "complete -c aisync -f",
    "",
    "# Top-level commands",
  ];

  for (const cmd of COMMANDS) {
    lines.push(
      `complete -c aisync -n "__fish_use_subcommand" -a "${cmd}" -d "${COMMAND_DESCRIPTIONS[cmd] ?? ""}"`,
    );
  }

  lines.push("", "# Subcommands");
  for (const [parent, subs] of Object.entries(SUBCOMMANDS)) {
    for (const sub of subs) {
      lines.push(
        `complete -c aisync -n "__fish_seen_subcommand_from ${parent}; and not __fish_seen_subcommand_from ${subs.join(" ")}" -a "${sub}"`,
      );
    }
  }

  lines.push("", "# Provider name completion after --only / --exclude");
  const provGuard = `__fish_seen_subcommand_from ${[...DIR_ARG_COMMANDS, "init"].join(" ")}`;
  for (const prov of providers) {
    lines.push(
      `complete -c aisync -n "${provGuard}" -l only -xa "${prov}"`,
      `complete -c aisync -n "${provGuard}" -s o -xa "${prov}"`,
      `complete -c aisync -n "${provGuard}" -l exclude -xa "${prov}"`,
      `complete -c aisync -n "${provGuard}" -s e -xa "${prov}"`,
    );
  }

  lines.push("", "# Per-command flags");
  for (const [cmd, flags] of Object.entries(FLAGS_BY_COMMAND)) {
    if (flags.length === 0) continue;
    const guard = `__fish_seen_subcommand_from ${cmd}`;
    for (const flag of flags) {
      if (
        flag === "--only" ||
        flag === "-o" ||
        flag === "--exclude" ||
        flag === "-e"
      ) {
        continue;
      }
      const desc = flagDescription(flag);
      if (flag.startsWith("--")) {
        const name = flag.slice(2);
        if (flag === "--debounce") {
          lines.push(
            `complete -c aisync -n "${guard}" -l ${name} -d "${desc}" -x`,
          );
        } else {
          lines.push(
            `complete -c aisync -n "${guard}" -l ${name} -d "${desc}"`,
          );
        }
      } else if (flag.length === 2) {
        const name = flag.slice(1);
        lines.push(`complete -c aisync -n "${guard}" -s ${name} -d "${desc}"`);
      }
    }
  }

  lines.push("", "# Re-enable file completion for path args on sync commands");
  for (const cmd of DIR_ARG_COMMANDS) {
    lines.push(`complete -c aisync -n "__fish_seen_subcommand_from ${cmd}" -F`);
  }

  return `${lines.join("\n")}\n`;
}

function flagDescription(flag: string): string {
  const map: Record<string, string> = {
    "--dry-run": "Show what would be done without doing it",
    "-d": "Show what would be done without doing it",
    "--force": "Overwrite existing files",
    "-f": "Overwrite existing files",
    "--verbose": "Show detailed output",
    "-v": "Show detailed output",
    "--quiet": "Suppress info output",
    "-q": "Suppress info output",
    "--interactive": "Force interactive provider selection",
    "-i": "Force interactive provider selection",
    "--link": "Use symlinks instead of copy",
    "-l": "Use symlinks instead of copy",
    "--debounce": "Debounce delay before re-syncing (ms)",
    "--json": "Output report as JSON",
    "--all": "Apply to all worktrees with a lock file",
    "--only": "Only sync these providers",
    "-o": "Only sync these providers",
    "--exclude": "Exclude these providers",
    "-e": "Exclude these providers",
  };
  return map[flag] ?? "";
}
