# TODO

Roadmap priorisée pour aisync, à attaquer petit à petit. Cocher au fur et à mesure.

## Quick wins (< 30 min, gros gain)

- [ ] **CHANGELOG.md** : reconstituer l'historique v0.1.0 → v0.8.0 depuis `git log`, alimenter à chaque release
- [ ] **GitHub Releases rétroactives** : `gh release create vX.Y.Z --generate-notes` pour v0.3.0, v0.4.0, v0.5.0, v0.6.0, v0.7.1, v0.8.0
- [ ] **CI GitHub Actions** : `.github/workflows/ci.yml` (pnpm install + check + test + build) sur push/PR
- [ ] **`--quiet` flag** sur copy/pull/link : réduit les logs à warn/error pour CI et scripts

## Mid-tier (1-3h)

- [ ] **Garde-fou drift dans pull/copy** : avant écrasement, comparer hash actuel au hash du lock, refuser sauf `--force`, signaler le drift
- [ ] **`pull --link`** : symétrie de `pull` avec symlinks au lieu de copy
- [ ] **Release script automatisé** : `pnpm release` (bump + commit + tag + push + npm publish + gh release)
- [ ] **Config globale utilisateur** : `~/.config/aisync/config.json` fusionnée avec la config projet

## Plus gros chantiers (½ journée+)

- [ ] **Site docs** (Astro Starlight ou VitePress) : quickstart, guides par workflow, reference des commandes, guide d'ajout de provider, déploiement GitHub Pages
- [ ] **Watch bidirectionnel** : détecter les changements dans toutes les destinations linkées et resync, gérer les boucles
- [ ] **Complétion shell** : `aisync completion bash/zsh/fish`
- [ ] **Plugins/providers tiers** : permettre l'ajout de providers via packages externes (registry dynamique)

## Ordre d'attaque suggéré

1. **Sprint 1** (1h max) : CHANGELOG + CI + GitHub Releases - passe le projet de "perso" à "sérieux" visuellement
2. **Sprint 2** (½ journée) : garde-fou drift + release script - fiabilise les flows réels
3. **Sprint 3** (1 journée) : `pull --link` + site docs basique - complète la surface et la rend découvrable
