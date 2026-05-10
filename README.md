# aisync

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

Watches the source worktree and re-syncs to all other worktrees on change. Useful when iterating on shared configs.

### Auto-sync on `git checkout`

```bash
aisync hook install
aisync hook remove
```

Installs (or removes) a `post-checkout` git hook that runs `aisync copy` after switching branches or creating a new worktree.

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

## Options

```
--only <provider>     Sync only specific providers (repeatable)
--exclude <provider>  Exclude providers (repeatable)
--dry-run             Show what would happen without doing it
--force               Overwrite existing files
--verbose             Detailed output
--interactive, -i     Force interactive provider selection
```

## Why

AI configs live in the working tree, not in `.git/`. Whether they're gitignored, local-only, or just not committed - a new worktree won't have them. You end up copying files by hand or writing fragile shell scripts.

This scales poorly, especially with agent orchestrators (Superset, Conductor, Emdash) that spin up dozens of worktrees in parallel.

### Orchestrator integration

```bash
# .conductor/setup.sh
aisync copy "$CONDUCTOR_MAIN_WORKTREE" "$(pwd)" --force
```

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
