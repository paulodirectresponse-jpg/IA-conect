# Final Visual QA — IA Connect

## Scope

Final source-level QA pass after the premium redesign phases.

Validated in code:
- semantic design tokens
- shell hierarchy
- image/video generators
- model picker
- prompt and generation CTA
- dashboard and creative surfaces
- wallet/settings/admin/auth
- public landing page
- reduced-motion behavior
- mobile layout safeguards
- light/dark theme compatibility
- CI lint/build/tests

## Motion

- Shared motion durations remain restrained.
- Reduced-motion users no longer receive autoplay loops on the landing hero or model showcase.
- Smooth scrolling falls back to instant scrolling when reduced motion is enabled.
- Decorative hover transforms are suppressed for reduced motion.
- Loading animations are disabled under reduced motion.
- Generator CTA remains visible at the bottom of the mobile configuration panel.

## Accessibility

- Shared focus-visible treatment is present for buttons, links, form controls and role=button elements.
- Important financial and generation states continue to use text plus semantic styling.
- Auto model mode remains generic and does not expose internal routing.
- Media retains a high-contrast stage in light theme.
- Primary CTA, price and wallet balance remain visually distinguishable.

## Responsive

Source-level checks were made for:
- sidebar overlay behavior
- mobile navbar
- generator panel height
- generator CTA reachability
- horizontal media galleries
- landing hero typography
- landing CTA stacking
- history rows
- community and library grids

## Browser QA status

Automated browser validation with Playwright MCP is still pending because the Playwright MCP server is not connected to this ChatGPT environment.

The repository CI is still the gate for:
- lint
- production build
- tests

A browser QA pass should later cover:
- 390px mobile
- 768px tablet
- 1440px desktop
- dark and light authenticated themes
- login/register
- image generation
- video generation
- wallet checkout
- community modal
- library/project navigation

## Design outcome

The redesign now follows one hierarchy:

1. generated media and primary task
2. prompt/model/configuration
3. financial/generation truth
4. navigation and operational context
5. secondary discovery

Decorative gradients, glows and card nesting are intentionally reduced outside brand, media and primary-action moments.
