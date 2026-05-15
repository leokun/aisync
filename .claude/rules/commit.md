---
description: Commit message format rules
globs: *
---

# Commit messages

Format: `{gitmoji} [{domain}] {short commit message}`

## Gitmoji

- ✨ New feature
- 🐛 Bug fix
- ♻️ Refactor
- 📝 Documentation
- 🎨 Code style / formatting
- 🔧 Configuration
- ✅ Tests
- 🚀 Deploy / release
- 🏗️ Architecture / structure
- ➕ Add dependency
- ➖ Remove dependency
- 🔥 Remove code / files
- 🚚 Move / rename
- 💄 UI / cosmetic
- 🔒 Security
- ⚡ Performance

## Domain

The domain refers to the module or area of code impacted: `cli`, `core`, `providers`, `utils`, `tests`, `config`, `docs`, `ci`.

## Examples

```
✨ [cli] add copy command with dry-run support
🐛 [core] fix atomic copy race condition on Windows
♻️ [providers] extract common scan logic
📝 [docs] update CLAUDE.md with architecture overview
🔧 [config] switch to 2-space indentation
✅ [tests] add unit tests for lock file parsing
➕ [config] add picocolors dependency
```

## Rules

- Message in English
- No trailing period
- First letter of message in lowercase
- Short and descriptive (< 72 chars total)
