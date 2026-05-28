#!/usr/bin/env sh
set -eu

if ! repo_root="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "Skipping Git hooks install: not inside a Git checkout"
  exit 0
fi

git -C "$repo_root" config core.hooksPath .githooks

chmod +x \
  "$repo_root/.githooks/pre-commit" \
  "$repo_root/.githooks/pre-push" \
  "$repo_root/.githooks/prepare-commit-msg" \
  "$repo_root/scripts/git-hooks-lib.sh" \
  "$repo_root/scripts/install-git-hooks.sh"

echo "Git hooks installed from .githooks (pre-commit, pre-push, prepare-commit-msg)"
