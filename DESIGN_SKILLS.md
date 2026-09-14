# Premium Design Skills — IA Connect

This repository vendors a coordinated design-review stack under `.agents/skills/`.

## Primary stack

| Skill | Role | Source |
| --- | --- | --- |
| impeccable | Primary UI/UX critique, hierarchy, polish and hardening | https://github.com/pbakaus/impeccable |
| ui-ux-pro-max | Searchable design intelligence, UX rules, typography, color, patterns and React/Tailwind guidance | https://github.com/nextlevelbuilder/ui-ux-pro-max-skill |
| frontend-design | Distinctive art direction and anti-template design guidance | https://github.com/anthropics/claude-code/tree/main/plugins/frontend-design/skills/frontend-design |
| emil-design-eng | Motion, micro-interaction and design-engineering polish | https://github.com/emilkowalski/skills |
| web-design-guidelines | Final web quality and accessibility audit | https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines |

## Supporting skills

- `review-animations` and `improve-animations` complement Emil's motion pass.
- `taste` remains available for extracting design principles from external references when browser tooling is connected.

## IA Connect order of operation

`impeccable → ui-ux-pro-max → frontend-design → emil-design-eng → web-design-guidelines`

The stack is intentionally sequential:
- Impeccable defines the product-safe design problem.
- UI/UX Pro Max supplies evidence and alternatives.
- Frontend Design challenges generic choices.
- Emil refines interaction and motion only after static hierarchy is stable.
- Vercel Guidelines performs the final quality gate.

## Compatibility notes

- Skills are stored in the project-local `.agents/skills/` format used by this repository.
- UI/UX Pro Max is vendored with its data, references, search scripts and all stack datasets. Its script paths are adapted to the IA Connect project-local location.
- Frontend Design and Web Design Guidelines are vendored as instruction skills.
- Impeccable and Emil were already present before this stack expansion.
- Playwright MCP is still a separate client-level dependency and is not installed by these files.

## Approval policy

Installing or consulting these skills does not authorize visual changes. New redesign implementation begins only after explicit user approval.
