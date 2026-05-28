#!/usr/bin/env bash
# Shared helpers for Oxidock git hooks (bash).

RED="\033[1;31m"
GREEN="\033[1;32m"
YELLOW="\033[1;33m"
NC="\033[0m"

remove_last_char_if_not_empty() {
  local value="$1"
  if [[ -n "$value" ]]; then
    value="${value%|}"
  fi
  printf '%s' "$value"
}

create_pattern() {
  local pattern=""
  local file_name
  for file_name in "$@"; do
    [[ -z "$file_name" ]] && continue
    pattern="${pattern}${file_name}|"
  done
  remove_last_char_if_not_empty "$pattern"
}

# Keep staged paths that are fully staged (no unstaged edits on the same path).
filter_fully_staged() {
  local unstaged_pattern="$1"
  shift
  local container=""
  local value
  for value in "$@"; do
    [[ -z "$value" ]] && continue
    if [[ -z "$unstaged_pattern" ]]; then
      container="${container}${value} "
      continue
    fi
    if ! printf '%s\n' "$value" | grep -qE "$unstaged_pattern"; then
      container="${container}${value} "
    fi
  done
  printf '%s' "${container%" "}"
}

add_files_to_staged_tree() {
  local files_paths=("$@")
  if [[ -n "${files_paths[*]// /}" ]]; then
    git add -- "${files_paths[@]}"
  fi
}

list_staged_files() {
  local pattern="$1"
  git diff --cached --diff-filter=ACMR --name-only -- "$@" | grep -E "$pattern" || true
}

list_unstaged_files() {
  local pattern="$1"
  git diff --diff-filter=ACMR --name-only -- "$@" | grep -E "$pattern" || true
}

can_autofix() {
  local fully_staged_count="$1"
  local staged_count="$2"
  [[ "$fully_staged_count" -eq "$staged_count" && "$staged_count" -gt 0 ]]
}
