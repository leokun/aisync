# aisync

[![CI](https://github.com/leokun/aisync/actions/workflows/ci.yml/badge.svg)](https://github.com/leokun/aisync/actions/workflows/ci.yml)

> Sync AI tool configurations between git worktrees.

AI tools store their configs in the working tree (`.claude/`, `.cursor/`, `CLAUDE.md`, etc.). These files often aren't tracked by git - whether gitignored, local-only, or simply absent in new worktrees.

**aisync** copies your AI environment from one worktree to another in a single command.

## Install

One-shot via npx:

```bash
npx @leokun-wasabee/aisync
```

Or install globally for a shorter command:

```bash
pnpm add -g @leokun-wasabee/aisync
# or: npm install -g @leokun-wasabee/aisync

aisync --version
```

The examples below use the global `aisync` command. Replace with `npx @leokun-wasabee/aisync` if you prefer not to install globally.

## Usage

### Copy configs to a new worktree

```bash
aisync copy . ../feature-auth
```

Copies all detected AI provider configs from the current worktree to the target.

### Re-sync later

```bash
cd ../feature-auth
aisync copy
```

Uses the `aisync-lock.json` saved from the first copy to re-sync from the original source.

### Bootstrap missing provider configs

```bash
aisync init
```

Detects your cross-tool base (`AGENTS.md`, `.agents/`) and generates missing provider-specific configs that reference it.

### Check what's detected

```bash
aisync status
aisync list providers
aisync list worktrees
```

### Symlink instead of copy

```bash
aisync link . ../feature-auth
```

Creates relative symlinks instead of copying files. Edits in the source are reflected immediately in the destination.

### Watch and re-sync automatically

```bash
aisync watch
```

Watches every participating worktree and re-syncs changes to all the others. Edits flow both ways: a change in the "main" worktree propagates to "feature-auth", and an edit in "feature-auth" propagates back.

Participants are determined from `aisync-lock.json` files: the source plus every sibling whose lock points back at the source. If no worktree has a lock yet (first run), all non-bare siblings are included as a bootstrap. The sync mode (`copy` or `link`) is inherited from the first lock found.

Loops are suppressed via an in-flight write guard. Hash equality short-circuits redundant events, so re-saving a file without changes does not trigger a re-sync.

### Auto-sync on `git checkout`

```bash
aisync hook install
aisync hook remove
```

Installs (or removes) a `post-checkout` git hook that runs `aisync copy` after switching branches or creating a new worktree.

### Shell completion

aisync ships completion scripts for bash, zsh, and fish:

```bash
# bash
aisync completion bash > /etc/bash_completion.d/aisync

# zsh (directory must be on $fpath)
aisync completion zsh > ~/.zfunc/_aisync

# fish
aisync completion fish > ~/.config/fish/completions/aisync.fish
```

### Diagnose sync state

```bash
aisync doctor
```

Compares the destination's `aisync-lock.json` against the source and the local files. Reports per-item status:

- `synced` : everything matches the lock
- `stale` : source has changed since the last sync
- `drift` : destination has local edits
- `conflict` : both source and destination changed
- `missing-source` / `missing-dest` : a tracked path no longer exists

Use `--json` for machine-readable output. Exit code is `1` when conflicts are present (CI-friendly).

### Clean a synced worktree

```bash
aisync clean              # remove items + lock from current worktree
aisync clean --dry-run    # preview
aisync clean --all        # clean every worktree that has a lock
```

Removes files and folders listed in `aisync-lock.json`, then deletes the lock file itself.

## Supported providers

| Provider | Files |
|----------|-------|
| Claude Code | `.claude/`, `CLAUDE.md` |
| Cursor | `.cursor/`, `.cursorrules` |
| OpenAI Codex | `.codex/` |
| GitHub Copilot | `.github/copilot/` |
| Windsurf | `.windsurf/`, `.windsurfrules` |
| Cline | `.clinerules` |
| Aider | `.aider.conf.yml`, `CONVENTIONS.md` |
| Cross-tool | `AGENTS.md`, `.agents/` |

### Interactive selection

When you run `copy`, `link`, or `init` in a TTY without `--only` or `--exclude`, aisync prompts you to pick which providers to sync. Pass `--only` / `--exclude` to skip the prompt, or use `-i, --interactive` to force it.

### Pull configs from another worktree

```bash
aisync pull                       # auto-detect a sibling worktree
aisync pull ../main               # explicit source
aisync pull ../main --link        # symlink instead of copy
```

`pull` is the inverse of `copy`: instead of pushing the current worktree to a destination, it brings configs from another worktree into the current directory.

## Options

```
--only <provider>     Sync only specific providers (repeatable)
--exclude <provider>  Exclude providers (repeatable)
--dry-run             Show what would happen without doing it
--force               Overwrite existing files (and drifted local edits)
--link, -l            Use symlinks instead of copy (pull only; copy/link behave by command, watch inherits mode from existing locks)
--verbose             Detailed output
--quiet, -q           Suppress info output (warnings/errors only)
--interactive, -i     Force interactive provider selection
```

### Drift protection

When `copy` or `pull` detects that a destination file has been modified locally since the last sync (its hash no longer matches `aisync-lock.json`), it skips the file and reports a `drift` warning instead of silently overwriting. Pass `--force` to overwrite drifted files.

## Configuration

aisync reads two config files and merges them, with project values overriding global values key by key:

| Level | Location |
|-------|----------|
| Global | `$XDG_CONFIG_HOME/aisync/config.json` (defaults to `~/.config/aisync/config.json`). On Windows: `%APPDATA%/aisync/config.json`. |
| Project | `.aisyncrc` at the project root (JSON). |

Supported keys: `source`, `only`, `exclude`, `providers`, `templates`.

```json
{
  "only": ["claude", "cursor"],
  "source": "../main"
}
```

Put your favorite providers in the global config to skip the prompt in every repo, and override per-project as needed.

## Why

AI configs live in the working tree, not in `.git/`. Whether they're gitignored, local-only, or just not committed - a new worktree won't have them. You end up copying files by hand or writing fragile shell scripts.

This scales poorly, especially with agent orchestrators (Superset, Conductor, Emdash) that spin up dozens of worktrees in parallel.

### Orchestrator integration

```bash
# .conductor/setup.sh
aisync copy "$CONDUCTOR_MAIN_WORKTREE" "$(pwd)" --force
```

## Release (maintainers)

```bash
pnpm release patch        # bumps 0.9.0 -> 0.9.1
pnpm release minor        # bumps 0.9.x -> 0.10.0
pnpm release major        # bumps 0.x.x -> 1.0.0
pnpm release 1.2.3        # explicit version
pnpm release patch --dry-run   # preview pipeline
```

`scripts/release.sh` handles version bump (package.json + src/index.ts), lint, tests, build, `CHANGELOG.md` entry, commit, tag, push, npm publish, and GitHub release in one pipeline.

## Roadmap

- **v0.1.0** - Copy + init
- **v0.2.0** - Symlink mode (`aisync link`)
- **v0.3.0** - More providers (Windsurf, Cline, Aider) + interactive selection
- **v0.4.0** - Config file (`.aisyncrc`)
- **v0.5.0** - Full interactive wizard
- **v0.6.0** - File watching + git hooks
- **v0.7.0** - Maintenance: `doctor` + `clean` (current)

## License

MIT
