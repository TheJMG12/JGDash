#!/usr/bin/env bash
# Clone or update plugin87/ux-ui-agent-skills, vendor the kit, and install
# every runnable skill into .cursor/skills/<slug>/ for Cursor.
set -euo pipefail

REPO_URL="https://github.com/plugin87/ux-ui-agent-skills.git"
CACHE="${UX_UI_SKILLS_CACHE:-/tmp/ux-ui-agent-skills}"
KIT_ROOT_REL=".cursor/skills/ux-ui-agent-skills/kit"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_dir="$(cd "$script_dir/.." && pwd)"
kit_dest="$skill_dir/kit"

if project_root="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  project_root="$(pwd)"
fi
cursor_skills="${CURSOR_SKILLS_DIR:-$project_root/.cursor/skills}"

usage() {
  cat <<EOF
Usage: $(basename "$0") [sync|install|list]

  sync      Clone/pull upstream, vendor the kit, install all 17 skills (default)
  install   Same as sync
  list      Print runnable skill slugs from the clone

Cache: $CACHE
Kit dest: $kit_dest
Cursor skills dir: $cursor_skills
EOF
}

clone_or_pull() {
  if [[ -d "$CACHE/.git" ]]; then
    echo "Updating $CACHE" >&2
    git -C "$CACHE" pull --ff-only >&2
  elif [[ -e "$CACHE" ]]; then
    echo "error: $CACHE exists but is not a git repo" >&2
    exit 1
  else
    echo "Cloning into $CACHE" >&2
    git clone "$REPO_URL" "$CACHE"
  fi
}

list_slugs() {
  find "$CACHE/.claude/skills" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort
}

vendor_kit() {
  mkdir -p "$kit_dest"
  python3 - "$CACHE" "$kit_dest" <<'PY'
import pathlib, shutil, sys

src = pathlib.Path(sys.argv[1])
dst = pathlib.Path(sys.argv[2])
skip = {".git", "node_modules"}

if dst.exists():
    shutil.rmtree(dst)
dst.mkdir(parents=True)

for item in src.iterdir():
    if item.name in skip:
        continue
    target = dst / item.name
    if item.is_dir():
        shutil.copytree(item, target, ignore=shutil.ignore_patterns(".git", "node_modules"))
    else:
        shutil.copy2(item, target)
PY
  echo "vendored kit -> $kit_dest" >&2
}

install_skills() {
  mkdir -p "$cursor_skills"
  python3 - "$CACHE" "$cursor_skills" "$KIT_ROOT_REL" "$skill_dir" <<'PY'
import pathlib, re, sys, textwrap

cache = pathlib.Path(sys.argv[1])
cursor_skills = pathlib.Path(sys.argv[2])
kit_root_rel = sys.argv[3]
skill_dir = pathlib.Path(sys.argv[4])
reserved = {"ux-ui-agent-skills", "mercury-agent-skills"}

preamble = textwrap.dedent(f"""
    ## Workspace kit root

    This playbook is from [plugin87/ux-ui-agent-skills](https://github.com/plugin87/ux-ui-agent-skills) (MIT).
    Resolve every relative path (`tokens/`, `workflows/`, `scripts/`, `accessibility/`, `taste/`, `design-systems/`, `frameworks/`, `components/`, `content/`, `examples/`, `.claude/rules/`) from:

    `{kit_root_rel}`

    Run Python/Node scripts from that directory. If this playbook conflicts with this repo's `AGENTS.md`, the project wins.
""").strip() + "\n\n"

skills_src = cache / ".claude" / "skills"
rows = []
for src in sorted(skills_src.glob("*/SKILL.md")):
    slug = src.parent.name
    if slug in reserved:
        print(f"skip {slug}", file=sys.stderr)
        continue
    text = src.read_text(encoding="utf-8")
    if not text.startswith("---"):
        raise SystemExit(f"error: {src} has no YAML frontmatter")
    parts = text.split("---", 2)
    if len(parts) < 3:
        raise SystemExit(f"error: {src} frontmatter is malformed")
    fm = parts[1]
    body = parts[2].lstrip("\n")
    if "## Workspace kit root" in body:
        body = re.sub(
            r"## Workspace kit root\n.*?(?=\n# |\Z)",
            "",
            body,
            count=1,
            flags=re.S,
        ).lstrip()
    dest_dir = cursor_skills / slug
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / "SKILL.md"
    dest.write_text(f"---{fm}---\n\n{preamble}{body}", encoding="utf-8")
    name = re.search(r"^name:\s*['\"]?([^'\"\n]+)", fm, re.M)
    desc = re.search(r"^description:\s*(.+)$", fm, re.M)
    d = (desc.group(1).strip().strip("'\"") if desc else "")
    rows.append((slug, name.group(1).strip() if name else slug, d))
    print(f"installed {slug} -> {dest}")

catalog = ["# UX/UI Agent Skills", "", f"Kit root: `{kit_root_rel}`", "", "| Slug | Description |", "|---|---|"]
for slug, _name, desc in rows:
    catalog.append(f"| `{slug}` | {desc.replace('|', '\\|')} |")
catalog.append("")
catalog.append(f"Total: {len(rows)} runnable skills.")
catalog.append("")
(skill_dir / "catalog.md").write_text("\n".join(catalog), encoding="utf-8")
print(f"wrote {skill_dir / 'catalog.md'}", file=sys.stderr)
PY
}

cmd="${1:-sync}"
case "$cmd" in
  -h|--help|help)
    usage
    exit 0
    ;;
  sync|install)
    clone_or_pull
    vendor_kit
    install_skills
    ;;
  list)
    clone_or_pull
    list_slugs
    ;;
  *)
    echo "error: unknown command '$cmd'" >&2
    usage >&2
    exit 1
    ;;
esac
