# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `aisync completion <bash|zsh|fish>` command emits a shell completion script to stdout. Covers all commands, subcommands, flags, and dynamic provider names sourced from the registry.

### Changed
- **Breaking**: `aisync watch` is now bidirectional. Changes in any participating worktree propagate to all others, not just from a single source. Participants are discovered from `aisync-lock.json` files; the sync mode is inherited from the first lock found.
- **Breaking**: removed the `-l/--link` flag from `aisync watch`. Mode is now read from existing locks; mixing modes across siblings is not supported within a single watch session.

## [0.9.0] - 2026-05-16

### Added
- `--quiet` / `-q` flag on every command (copy, pull, link, init, status, list, watch, doctor, clean) to suppress info output while still showing warnings and errors.
- GitHub Actions CI workflow running lint, tests, and build on every push and pull request (Node 24, pnpm).
- `CHANGELOG.md` documenting the project history from v0.1.0 onwards.

## [0.8.0] - 2026-05-15

### Added
- `aisync pull` command to fetch configs from another worktree into the current directory, with auto-detection of candidate sources from sibling worktrees.

### Changed
- Translated all remaining French strings in the codebase to English.
- Switched all dependency ranges to caret (`^`) for predictable minor updates.

## [0.7.1] - 2026-05-14

### Added
- `aisync doctor` command to diagnose sync state against `aisync-lock.json` (per-item statuses: synced, stale, drift, conflict, missing-source, missing-dest). Supports `--json` for CI use.
- `aisync clean` command to remove synced items and the lock file, with `--all`, `--dry-run`, and `--force` flags.

### Changed
- README updated to document the new maintenance commands.

## [0.6.0] - 2026-05-10

### Added
- `aisync watch` command to monitor a source worktree and re-sync to all other worktrees on change, with debounce control.
- `aisync hook install` / `aisync hook remove` to manage a `post-checkout` git hook that auto-syncs configs on branch/worktree checkout.

## [0.5.0] - 2026-05-10

### Added
- Interactive wizard mode: running `aisync` with no arguments in a TTY launches a guided flow over copy, link, pull, init, status, and list.

## [0.4.0] - 2026-05-10

### Added
- `.aisyncrc` configuration file support with custom providers, templates, default source, and persistent `only` / `exclude` lists.

## [0.3.0] - 2026-05-10

### Added
- Windsurf, Cline, and Aider providers.
- Interactive provider selection (TTY) for `copy`, `link`, and `init` when no `--only` / `--exclude` is passed. Use `-i` to force the prompt.

## [0.2.2] - 2026-04-15

### Changed
- Renamed package to `@leokun-wasabee/aisync`.

## [0.2.1] - 2026-04-15

### Changed
- Renamed package to `@leokun/aisync`.

## [0.2.0] - 2026-04-15

### Added
- Symlink sync mode via `aisync link`.
- Shared sync module powering both `copy` and `link`.
- Unit tests for core sync logic.

## [0.1.0] - 2026-04-15

### Added
- Initial release: `aisync copy` and `aisync init`.
- Provider registry (Claude, Cursor, Codex, Copilot, cross-tool base).
- `aisync-lock.json` tracking for re-sync.
- `aisync status`, `aisync list providers`, `aisync list worktrees`.

[0.9.0]: https://github.com/leokun/aisync/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/leokun/aisync/compare/v0.7.1...v0.8.0
[0.7.1]: https://github.com/leokun/aisync/compare/v0.6.0...v0.7.1
[0.6.0]: https://github.com/leokun/aisync/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/leokun/aisync/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/leokun/aisync/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/leokun/aisync/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/leokun/aisync/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/leokun/aisync/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/leokun/aisync/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/leokun/aisync/releases/tag/v0.1.0
