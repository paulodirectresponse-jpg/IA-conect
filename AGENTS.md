# IA-conect Agent Guidance

For any frontend redesign or visual refinement, read `PRODUCT.md` and `DESIGN.md` first.

Project-local skills live in `.agents/skills/`.

## Recommended visual workflow

1. Use **taste** when reference websites are provided. Extract design DNA and trade-offs; do not clone.
2. Use **impeccable** for whole-interface critique, hierarchy, layout, typography, accessibility, responsive quality and polish.
3. Use **emil-design-eng** and the installed animation review skills for motion and micro-interactions.
4. Use Playwright MCP, when connected, to inspect the real rendered site at desktop and mobile sizes.
5. Use Figma MCP, when connected, only when Figma context materially helps the task.
6. Run lint, build and tests before merging UI changes.

For a whole-site repagination, audit first, propose the direction second, then implement in controlled passes. Do not blindly redesign every screen in one unverified batch.
