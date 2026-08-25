---
name: design-review
description: Review or audit a design/UI across 6 weighted dimensions with Nielsen's 10 heuristics and a prioritized findings table. Use when the user wants a design critique, quality score, heuristic evaluation, or audit of an existing screen, page, or product before/after build.
invocation: model
---

## Workspace kit root

This playbook is from [plugin87/ux-ui-agent-skills](https://github.com/plugin87/ux-ui-agent-skills) (MIT).
Resolve every relative path (`tokens/`, `workflows/`, `scripts/`, `accessibility/`, `taste/`, `design-systems/`, `frameworks/`, `components/`, `content/`, `examples/`, `.claude/rules/`) from:

`.cursor/skills/ux-ui-agent-skills/kit`

Run Python/Node scripts from that directory. If this playbook conflicts with this repo's `AGENTS.md`, the project wins.

# Skill: Design Review

Run a structured, scored review.

## Steps
1. Read `workflows/design-review.md` (rubric, scoring guide, Nielsen heuristics, process).
2. Gather context: the screen(s)/flow, target users, platform, constraints.
3. Score the 6 dimensions (Visual Hierarchy 20%, Consistency 20%, Accessibility 20%, Usability 20%, Responsiveness 10%, Performance 10%); compute the weighted overall.
4. Run the accessibility lens with `accessibility/wcag-checklist.md`; use `scripts/contrast.py` for any color-pair doubts.
5. Check against the anti-slop tells in `taste/design-taste.md` (Banned Defaults checklist).
6. Apply Nielsen's 10 heuristics; flag violations by number.

## Output
- The 6-dimension scored table + overall score.
- A prioritized findings table: # · Severity (Critical → Major → Minor → Enhancement) · Finding · Recommendation.
- Concrete, token-referenced fixes.
