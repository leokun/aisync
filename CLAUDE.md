# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm build            # Bundle to dist/index.mjs (tsdown)
pnpm dev              # Watch mode
pnpm check            # Biome lint + format check
pnpm check:fix        # Auto-fix lint/format issues
pnpm test             # Run tests (vitest)
pnpm test:watch       # Watch mode
```

Test the CLI directly after build:
```bash
node dist/index.mjs <command>
```

## Architecture

CLI tool that syncs AI tool configurations (.claude/, .cursor/, .codex/, etc.) between git worktrees of the same repo.

**Layer structure:**
- `src/index.ts` - CLI entry point wiring Commander subcommands
- `src/commands/` - Command handlers (copy, init, status, list). Each receives parsed args and orchestrates core modules.
- `src/core/` - Business logic: `scanner` detects providers in a directory, `copier` handles atomic file copy with hash tracking, `lock` manages `aisync-lock.json` state, `bootstrapper` generates missing provider configs from cross-tool base, `git` wraps CLI git calls for worktree detection.
- `src/providers/` - Provider definitions (name + paths to sync). `registry.ts` holds the array and filtering logic (`--only`/`--exclude`). Adding a provider = new file + import in registry.
- `src/utils/` - Filesystem helpers (atomic copy via temp+rename), SHA256 hashing (first 8 hex chars), colored terminal output via picocolors.

**Key pattern:** Providers are static data objects (`{ name, label, paths }`), not classes. The scanner checks which paths exist, copier copies them, bootstrapper generates missing ones.

## Conventions

- ESM only (`"type": "module"`, `.js` extensions in imports)
- 2 spaces for indentation (Biome)
- Errors: `log.error()` + `process.exitCode = 1`, no thrown exceptions in commands
- Atomic file writes: write to `.aisync-tmp-*` then rename
- Git operations via `node:child_process` execFile, no git library

## Roadmap context

Currently implementing v0.1.0 MVP. Plans are in `plans/` - see `plans/v0.1.0-mvp.md` for current scope, `plans/prd.md` for full context.
