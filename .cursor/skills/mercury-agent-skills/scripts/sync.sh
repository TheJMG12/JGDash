#!/usr/bin/env bash
# Clone or update cosmicstack-labs/mercury-agent-skills, then optionally copy
# playbooks into .cursor/skills/<slug>/ for Cursor.
set -euo pipefail

REPO_URL="https://github.com/cosmicstack-labs/mercury-agent-skills.git"
CACHE="${MERCURY_SKILLS_CACHE:-/tmp/mercury-agent-skills}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_dir="$(cd "$script_dir/.." && pwd)"

# Project root: git toplevel if available, else CWD.
if project_root="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  project_root="$(pwd)"
fi
cursor_skills="${CURSOR_SKILLS_DIR:-$project_root/.cursor/skills}"

usage() {
  cat <<EOF
Usage: $(basename "$0") [sync|install <slug> ...|install-all|list]

  sync              Clone or pull the Mercury skills library (default)
  install <slug>…   Copy named playbooks into .cursor/skills/<slug>/
  install-all       Copy every playbook from the clone (large)
  list              Print category/slug paths in the clone

Cache: $CACHE
Cursor skills dir: $cursor_skills
EOF
}

clone_or_pull() {
  if [[ -d "$CACHE/.git" ]]; then
    echo "Updating $CACHE"
    git -C "$CACHE" pull --ff-only
  elif [[ -e "$CACHE" ]]; then
    echo "error: $CACHE exists but is not a git repo" >&2
    exit 1
  else
    echo "Cloning into $CACHE"
    git clone "$REPO_URL" "$CACHE"
  fi
}

list_skill_dirs() {
  find "$CACHE/categories" -mindepth 2 -maxdepth 2 -type d | sort
}

resolve_slug_dir() {
  local slug="$1"
  local matches=()
  local dir
  while IFS= read -r dir; do
    if [[ "$(basename "$dir")" == "$slug" ]]; then
      matches+=("$dir")
    fi
  done < <(list_skill_dirs)

  if [[ ${#matches[@]} -eq 0 ]]; then
    echo "error: no Mercury skill named '$slug'" >&2
    echo "hint: run: $0 list" >&2
    exit 1
  fi
  if [[ ${#matches[@]} -gt 1 ]]; then
    echo "error: slug '$slug' matched more than one path:" >&2
    printf '  %s\n' "${matches[@]}" >&2
    exit 1
  fi
  printf '%s\n' "${matches[0]}"
}

install_one() {
  local slug="$1"
  local src
  src="$(resolve_slug_dir "$slug")"
  if [[ ! -f "$src/SKILL.md" ]]; then
    echo "error: missing SKILL.md in $src" >&2
    exit 1
  fi
  local dest="$cursor_skills/$slug"
  mkdir -p "$dest"
  # Copy playbook files only (skip nested .git if any).
  cp -R "$src/." "$dest/"
  echo "installed $slug -> $dest"
}

cmd="${1:-sync}"
case "$cmd" in
  -h|--help|help)
    usage
    exit 0
    ;;
  sync)
    clone_or_pull
    ;;
  list)
    clone_or_pull
    list_skill_dirs | while IFS= read -r dir; do
      rel="${dir#"$CACHE/"}"
      echo "$rel"
    done
    ;;
  install)
    shift
    if [[ $# -eq 0 ]]; then
      echo "error: install requires at least one slug" >&2
      usage >&2
      exit 1
    fi
    clone_or_pull
    mkdir -p "$cursor_skills"
    for slug in "$@"; do
      if [[ "$slug" == "mercury-agent-skills" ]]; then
        echo "skip mercury-agent-skills (router skill lives at $skill_dir)"
        continue
      fi
      install_one "$slug"
    done
    ;;
  install-all)
    clone_or_pull
    mkdir -p "$cursor_skills"
    while IFS= read -r dir; do
      slug="$(basename "$dir")"
      if [[ "$slug" == "mercury-agent-skills" ]]; then
        continue
      fi
      install_one "$slug"
    done < <(list_skill_dirs)
    ;;
  *)
    echo "error: unknown command '$cmd'" >&2
    usage >&2
    exit 1
    ;;
esac
