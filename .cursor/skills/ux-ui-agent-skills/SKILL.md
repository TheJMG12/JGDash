---
name: ux-ui-agent-skills
description: Applies the plugin87 UX/UI Agent Skills kit (design tokens, a11y, design review, component/code generation, 138 design systems) in this JGDash workspace. Use when the user mentions ux-ui-agent-skills, plugin87, WCAG UI audits, design tokens, apply-aesthetic, design-code, design-review, or asks to clone https://github.com/plugin87/ux-ui-agent-skills.git.
---

# UX/UI Agent Skills

[plugin87/ux-ui-agent-skills](https://github.com/plugin87/ux-ui-agent-skills) (MIT) — token-driven UX/UI playbooks, WCAG 2.2 gates, and 138 design systems.

The kit is vendored at `.cursor/skills/ux-ui-agent-skills/kit/`. All 17 runnable skills are also installed as Cursor skills under `.cursor/skills/<slug>/`. Resolve every relative path in those playbooks from the kit directory.

If a playbook conflicts with this repo's `AGENTS.md` (static HTML pages, `localStorage`, hamburger z-order, owner-only auth), the project wins.

## Clone

git clone https://github.com/plugin87/ux-ui-agent-skills.git

Refresh the vendored kit and the 17 Cursor skills:

```bash
bash .cursor/skills/ux-ui-agent-skills/scripts/sync.sh
```

## Workspace skills

| Slug | Use when |
|---|---|
| `design-tokens` | Palettes, type scale, DTCG tokens |
| `token-build` | Token → CSS/Tailwind/platform export |
| `brandkit` | From-scratch brand token kit |
| `apply-aesthetic` | Look/vibe or a named design system |
| `design-component` | Component spec before code |
| `design-code` | Production UI code for a framework |
| `image-to-code` | Screenshot/mockup → code |
| `migrate-design-system` | Map to/from Material, HIG, shadcn, … |
| `a11y-audit` | WCAG 2.2 / ARIA audit |
| `design-review` | Heuristic scored critique |
| `design-qa` | Design QA gates |
| `performance` | Core Web Vitals for UI |
| `prototype` | Fidelity ladder, journeys, tests |
| `redesign` | Polish an existing UI |
| `ux-writing` | UI copy, errors, empty states |
| `figma-integration` | Figma ↔ tokens/code |
| `governance` | SemVer, deprecation, contributions |

Pick the matching slug and follow that `SKILL.md`. Do not dump the playbook into the reply.

## Scripts

From the kit root:

```bash
cd .cursor/skills/ux-ui-agent-skills/kit
python3 scripts/validate_tokens.py
python3 scripts/contrast.py "<fg>" "<bg>"
```

Playwright-based render gates need `playwright` installed; skip them if it is missing and use the Python contrast/token checks instead.

## Additional resources

- Sync script: [scripts/sync.sh](scripts/sync.sh) (execute it)
- Kit index: [catalog.md](catalog.md)
- Upstream: `kit/README.md`, `kit/CLAUDE.md`
