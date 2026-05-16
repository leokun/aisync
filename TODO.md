# TODO

Prioritized roadmap for aisync, to tackle bit by bit. Check off as you go.

## Quick wins (< 30 min, big payoff)

- [x] **CHANGELOG.md**: reconstruct the v0.1.0 → v0.8.0 history from `git log`, keep it updated on every release
- [x] **Retroactive GitHub Releases**: `gh release create vX.Y.Z --generate-notes` for v0.3.0, v0.4.0, v0.5.0, v0.6.0, v0.7.1, v0.8.0
- [x] **GitHub Actions CI**: `.github/workflows/ci.yml` (pnpm install + check + test + build) on push/PR
- [x] **`--quiet` flag** on copy/pull/link: drops logs to warn/error for CI and scripts

## Mid-tier (1-3h)

- [x] **Drift guard in pull/copy**: before overwriting, compare current hash to the lock hash, refuse unless `--force`, report the drift
- [x] **`pull --link`**: mirror of `pull` using symlinks instead of copy
- [x] **Automated release script**: `pnpm release` (bump + commit + tag + push + npm publish + gh release)
- [x] **Global user config**: `~/.config/aisync/config.json` merged with the project config

## Bigger efforts (½ day+)

- [ ] **Docs site** (Astro Starlight or VitePress): quickstart, workflow-based guides, command reference, provider authoring guide, GitHub Pages deployment
- [ ] **Bidirectional watch**: detect changes in every linked destination and resync, handle loops
- [ ] **Shell completion**: `aisync completion bash/zsh/fish`
- [ ] **Third-party plugins/providers**: allow providers to be added via external packages (dynamic registry)

## Suggested order of attack

1. **Sprint 1** (1h max): CHANGELOG + CI + GitHub Releases - moves the project from "personal" to "serious" at a glance
2. **Sprint 2** (½ day): drift guard + release script - hardens the real-world flows
3. **Sprint 3** (1 day): `pull --link` + basic docs site - rounds out the surface area and makes it discoverable
