# IA-conect Agent Guidance

For any frontend redesign or visual refinement, read `PRODUCT.md` and `DESIGN.md` first.

Project-local skills live in `.agents/skills/`.

## Recommended visual workflow

1. Use **impeccable** as the primary design authority for critique, hierarchy, layout, typography, accessibility, responsive quality and polish.
2. Use **ui-ux-pro-max** as the evidence layer for patterns, typography, color, UX rules and React/Tailwind implementation guidance.
3. Use **frontend-design** selectively to strengthen art direction and challenge generic or template-like choices.
4. Use **emil-design-eng**, **review-animations** and **improve-animations** after static hierarchy is stable, for motion and micro-interactions.
5. Use **web-design-guidelines** as the final quality gate.
6. Use **taste** when reference websites are provided. Extract design DNA and trade-offs; do not clone.
7. Use Playwright MCP, when connected, to inspect the real rendered site at desktop and mobile sizes.
8. Use Figma MCP, when connected, only when Figma context materially helps the task.
9. Run lint, build and tests before merging UI changes.

For a whole-site repagination, audit first, propose the direction second, then implement in controlled passes. Do not blindly redesign every screen in one unverified batch.


## Approval gate

The design skills may audit and prepare recommendations, but do not implement a new visual redesign until the user explicitly asks to apply it.
