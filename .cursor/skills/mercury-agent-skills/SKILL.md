---
name: mercury-agent-skills
description: Clones the Mercury Agent Skills library (cosmicstack-labs/mercury-agent-skills) and applies the matching SKILL.md playbook. Use when the user mentions Mercury skills, mercury-agent-skills, cosmicstack-labs, skills.mercuryagent.sh, or asks to git clone https://github.com/cosmicstack-labs/mercury-agent-skills.git and install playbooks into .cursor/skills.
---

# Mercury Agent Skills

Open-source `SKILL.md` playbooks from [cosmicstack-labs/mercury-agent-skills](https://github.com/cosmicstack-labs/mercury-agent-skills) (MIT). Browse at [skills.mercuryagent.sh](https://skills.mercuryagent.sh).

Do not vendor the whole library into this repo unless the user asks. Clone to a cache, read the matching playbook, follow it. Install only the slugs the user named.

## Clone

git clone https://github.com/cosmicstack-labs/mercury-agent-skills.git

Prefer the helper (clone or `git pull --ff-only`, then optional install):

```bash
bash .cursor/skills/mercury-agent-skills/scripts/sync.sh
```

Cache default: `/tmp/mercury-agent-skills`. Override with `MERCURY_SKILLS_CACHE`.

## Apply a playbook

1. Match the task to a slug in [catalog.md](catalog.md).
2. Ensure the clone exists (`scripts/sync.sh` with no args).
3. Read `$MERCURY_SKILLS_CACHE/categories/<category>/<slug>/SKILL.md` (path is in the catalog).
4. Follow that playbook for the current task. If it conflicts with this repo's `AGENTS.md` or project conventions, the project wins.
5. Do not dump the playbook into the user reply. Execute it.

If several slugs fit, pick the most specific one. Read at most two playbooks unless the user asked for a sweep.

## Install into Cursor

Cursor loads `.cursor/skills/<slug>/SKILL.md`.

```bash
# one or more slugs
bash .cursor/skills/mercury-agent-skills/scripts/sync.sh install code-review git-workflow

# every playbook from the clone (large; only if the user asked)
bash .cursor/skills/mercury-agent-skills/scripts/sync.sh install-all
```

After install, the copied `SKILL.md` is the source of truth for that slug. Do not also keep a nested git clone of the library inside the project tree.

## Examples

**Apply without installing**

User: "Review this PR using Mercury code-review."
Agent: sync clone → read `categories/development/code-review/SKILL.md` → review with that checklist.

**Install named playbooks**

User: "Add the Mercury Docker and CI/CD skills."
Agent:

```bash
bash .cursor/skills/mercury-agent-skills/scripts/sync.sh install docker-patterns ci-cd-pipeline
```

**Refresh the clone**

User: "Update Mercury skills."
Agent: run `scripts/sync.sh` (pull if the cache already exists).

## Additional resources

- Skill index: [catalog.md](catalog.md)
- Sync/install script: [scripts/sync.sh](scripts/sync.sh) (execute it)
- Upstream catalog: `CATALOG.md` in the clone
