# aisync

> Sync AI tool configurations between git worktrees.

AI tools store their configs in the working tree (`.claude/`, `.cursor/`, `CLAUDE.md`, etc.). These files often aren't tracked by git - whether gitignored, local-only, or simply absent in new worktrees.

**aisync** copies your AI environment from one worktree to another in a single command.

## Install

```bash
npx aisync
```

## Usage

### Copy configs to a new worktree

```bash
npx aisync copy . ../feature-auth
```

Copies all detected AI provider configs from the current worktree to the target.

### Re-sync later

```bash
cd ../feature-auth
npx aisync copy
```

Uses the `aisync-lock.json` saved from the first copy to re-sync from the original source.

### Bootstrap missing provider configs

```bash
npx aisync init
```

Detects your cross-tool base (`AGENTS.md`, `.agents/`) and generates missing provider-specific configs that reference it.

### Check what's detected

```bash
npx aisync status
npx aisync list providers
npx aisync list worktrees
```

## Supported providers

| Provider | Files |
|----------|-------|
| Claude Code | `.claude/`, `CLAUDE.md` |
| Cursor | `.cursor/`, `.cursorrules` |
| OpenAI Codex | `.codex/` |
| GitHub Copilot | `.github/copilot/` |
| Cross-tool | `AGENTS.md`, `.agents/` |

## Options

```
--only <provider>     Sync only specific providers (repeatable)
--exclude <provider>  Exclude providers (repeatable)
--dry-run             Show what would happen without doing it
--force               Overwrite existing files
--verbose             Detailed output
```

## Why

AI configs live in the working tree, not in `.git/`. Whether they're gitignored, local-only, or just not committed - a new worktree won't have them. You end up copying files by hand or writing fragile shell scripts.

This scales poorly, especially with agent orchestrators (Superset, Conductor, Emdash) that spin up dozens of worktrees in parallel.

### Orchestrator integration

```bash
# .conductor/setup.sh
npx aisync copy "$CONDUCTOR_MAIN_WORKTREE" "$(pwd)" --force
```

## Roadmap

- **v0.1.0** - Copy + init (current)
- **v0.2.0** - Symlink mode (`aisync link`)
- **v0.3.0** - More providers (Windsurf, Cline, Aider)
- **v0.4.0** - Config file (`.aisyncrc`)
- **v0.6.0** - File watching + git hooks
- **v0.7.0** - Diagnostics (`aisync doctor`)

## License

MIT
