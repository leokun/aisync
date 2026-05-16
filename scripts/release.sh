#!/usr/bin/env bash
# aisync release script - one-shot pipeline for cutting a new version.
#
# Usage:
#   ./scripts/release.sh patch|minor|major
#   ./scripts/release.sh 1.2.3
#   ./scripts/release.sh patch --dry-run

set -u

DRY_RUN=0
ARG=""

for a in "$@"; do
  case "$a" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help)
      echo "Usage: $0 <patch|minor|major|X.Y.Z> [--dry-run]"
      exit 0
      ;;
    *) ARG="$a" ;;
  esac
done

if [[ -z "$ARG" ]]; then
  echo "Error: missing version argument."
  echo "Usage: $0 <patch|minor|major|X.Y.Z> [--dry-run]"
  exit 1
fi

run() {
  if [[ $DRY_RUN -eq 1 ]]; then
    echo "  [dry-run] $*"
    return 0
  fi
  "$@"
}

fail() {
  echo ""
  echo "Error: $1"
  exit 1
}

step() {
  echo ""
  echo ">> $1"
}

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || fail "cannot cd to repo root"

# 1. Working tree clean
step "Checking working tree is clean"
if ! git diff --quiet || ! git diff --cached --quiet; then
  fail "working tree has uncommitted changes; commit or stash first"
fi

# 2. On main
step "Checking branch is main"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "main" ]]; then
  fail "not on main (current: $BRANCH)"
fi

# 3. Compute new version
CURRENT="$(node -p "require('./package.json').version")"
echo "  Current version: $CURRENT"

case "$ARG" in
  patch|minor|major)
    NEW="$(node -e "
      const [maj,min,pat] = '$CURRENT'.split('.').map(Number);
      const bump = '$ARG';
      if (bump === 'major') console.log(\`\${maj+1}.0.0\`);
      else if (bump === 'minor') console.log(\`\${maj}.\${min+1}.0\`);
      else console.log(\`\${maj}.\${min}.\${pat+1}\`);
    ")"
    ;;
  *)
    if [[ ! "$ARG" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      fail "invalid version: $ARG (must be patch|minor|major or X.Y.Z)"
    fi
    NEW="$ARG"
    ;;
esac

echo "  New version:     $NEW"
TAG="v$NEW"

# 4. Bump version files
step "Bumping version to $NEW"
run npm pkg set "version=$NEW" >/dev/null || fail "npm pkg set failed"
if [[ $DRY_RUN -eq 0 ]]; then
  # Update version string in src/index.ts (.version("X.Y.Z"))
  if ! sed -i.bak -E "s/\.version\(\"[0-9]+\.[0-9]+\.[0-9]+\"\)/.version(\"$NEW\")/" src/index.ts; then
    fail "sed on src/index.ts failed"
  fi
  rm -f src/index.ts.bak
fi

# 5. Check + test + build
step "Running pnpm check"
run pnpm check || fail "lint/format check failed"

step "Running pnpm test"
run pnpm test || fail "tests failed"

step "Running pnpm build"
run pnpm build || fail "build failed"

# 6. CHANGELOG - prepend section
step "Updating CHANGELOG.md"
TODAY="$(date +%Y-%m-%d)"
if [[ $DRY_RUN -eq 0 ]]; then
  if ! grep -q "^## \[$NEW\]" CHANGELOG.md; then
    TMP="$(mktemp)"
    awk -v ver="$NEW" -v today="$TODAY" '
      BEGIN { inserted = 0 }
      /^## \[/ && !inserted {
        print "## [" ver "] - " today
        print ""
        print "### Added"
        print "- (edit me)"
        print ""
        inserted = 1
      }
      { print }
    ' CHANGELOG.md > "$TMP"
    mv "$TMP" CHANGELOG.md
  fi
  EDITOR_CMD="${EDITOR:-vi}"
  echo "  Opening CHANGELOG.md in $EDITOR_CMD (edit the new [$NEW] section, save and quit)"
  $EDITOR_CMD CHANGELOG.md || fail "editor exited with error"
else
  echo "  [dry-run] would prepend ## [$NEW] - $TODAY section and open editor"
fi

# 7. Commit + tag
step "Committing version bump"
run git add package.json src/index.ts CHANGELOG.md || fail "git add failed"
run git commit -m "🔖 [config] bump version to $NEW" || fail "git commit failed"

step "Tagging $TAG"
run git tag "$TAG" || fail "git tag failed"

# 8. Push
step "Pushing main and tag"
run git push origin main || fail "git push origin main failed"
run git push origin "$TAG" || fail "git push tag failed"

# 9. Publish to npm
step "Publishing to npm"
run pnpm publish --access public --no-git-checks || fail "pnpm publish failed"

# 10. GitHub release
step "Creating GitHub release $TAG"
if [[ $DRY_RUN -eq 0 ]]; then
  NOTES="$(awk -v ver="$NEW" '
    $0 ~ "^## \\[" ver "\\]" { capture = 1; next }
    capture && /^## \[/ { exit }
    capture { print }
  ' CHANGELOG.md)"
  if [[ -z "$NOTES" ]]; then
    NOTES="Release $TAG"
  fi
  echo "$NOTES" | gh release create "$TAG" --title "$TAG" --notes-file - || fail "gh release create failed"
else
  echo "  [dry-run] would run gh release create $TAG with CHANGELOG section"
fi

echo ""
echo "Release $TAG complete."
