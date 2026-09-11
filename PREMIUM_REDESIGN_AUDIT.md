# IA-conect — Premium Redesign Audit

## Executive summary

The current IA-conect visual foundation is already strong enough to preserve. The redesign should not replace the product's identity; it should increase coherence, readability, perceived quality, and interaction confidence.

The biggest opportunity is not "more effects". It is a tighter design system, clearer hierarchy, better type scale, fewer competing surface treatments, and more deliberate motion.

## What is already working

- Strong dark-studio identity with blue/cyan accents.
- Public landing page has a clear visual center and strong media-led hero.
- Image/video creation flows already feel purpose-built rather than generic forms.
- Model covers materially improve perceived quality and model differentiation.
- Global shell structure is simple and understandable.
- Community and media-heavy surfaces use the generated content as the visual focus.
- Light theme exists and covers the authenticated application.
- Key financial/generation states are explicit.

## Priority 0 — preserve

Do not change these without a specific product reason:

- Auto model routing must remain visually generic and must not reveal the internal selected AI.
- Generation price, balance, disabled states, validation errors, and generation state must stay explicit.
- Model media should remain prominent.
- Dark and light themes must both remain supported.
- Mobile must stay functional during every redesign phase.
- Product behavior must not be coupled to decorative components.

## Priority 1 — typography and hierarchy

### Problem

A large portion of the UI uses 8–10px text, especially metadata, labels, descriptions, tabs, badges, and secondary controls.

This creates:
- weaker readability,
- reduced perceived quality,
- overly dense hierarchy,
- too much dependence on color/weight to distinguish importance.

### Direction

Create a small semantic type system and migrate the UI gradually:

- Display / hero
- Page title
- Section title
- Body
- Compact body
- Label
- Caption / metadata

Avoid using sub-10px text for important product information. Reserve very small text for truly tertiary metadata only.

## Priority 2 — surface hierarchy

### Problem

Many screens repeat the same recipe:
- rounded rectangle,
- subtle blue border,
- blue/cyan radial gradient,
- glow or shadow,
- another rounded card inside.

The individual pieces look good, but repetition flattens hierarchy and creates a recognizable "AI dashboard" pattern.

### Direction

Reduce the number of surface levels.

Use:
- canvas,
- primary surface,
- secondary surface,
- interactive control,
- media stage,
- elevated overlay.

Cards should exist only when they group related information.

Reserve gradients and glows for:
- primary CTA,
- hero / brand moment,
- selected or high-attention state,
- media/model presentation.

## Priority 3 — tokenization and component consistency

### Problem

The current visual system is split between:
- CSS variables,
- hard-coded hex colors,
- Tailwind utilities,
- one-off arbitrary values,
- global selector overrides.

This makes visual consistency expensive to maintain.

### Direction

Introduce semantic tokens for:
- surfaces,
- borders,
- text hierarchy,
- accent,
- semantic states,
- radius,
- spacing,
- shadow,
- motion.

Then migrate shared components first:
- buttons,
- fields,
- cards/surfaces,
- tabs,
- badges,
- dialogs,
- popovers,
- nav items,
- media cards.

## Priority 4 — light theme architecture

### Problem

The authenticated light theme is currently maintained through a large set of broad CSS overrides and selectors that target class fragments and use many `!important` rules.

This works visually, but it is fragile and makes future redesign work slower and riskier.

### Direction

Do not rewrite the theme in one step.

Refactor incrementally:
1. define semantic tokens for dark/light,
2. migrate shared primitives,
3. migrate major surfaces,
4. remove obsolete global overrides only after each migrated area is verified.

## Priority 5 — navigation shell

### Current strengths

- Sidebar is compact.
- Navbar keeps balance and account access visible.
- Main navigation is easy to understand.

### Opportunities

- Reduce decorative treatment in the active sidebar state.
- Re-evaluate the promotional card at the bottom of the sidebar; it competes with navigation without adding a core task.
- Make the global "Criar" action clearer about image vs video instead of always routing to video.
- Remove or complete any non-functional chrome, such as notification affordances that do not yet provide meaningful value.

## Priority 6 — landing page

### Current strengths

- Strong hero video.
- Clear primary CTA.
- Good model showcase and gallery concept.

### Opportunities

- Simplify the four feature chips inside the hero; they currently compete with the main message.
- Increase secondary copy readability.
- Reduce repeated section-card patterns in the lower page.
- Give each major section a stronger compositional identity instead of repeating "eyebrow + title + cards".
- Keep the landing visually expressive, but not at the cost of message clarity.

## Priority 7 — dashboard

### Problem

The dashboard currently has several high-attention elements at similar strength:
- large welcome hero,
- two creation cards,
- model showcase,
- recent creations.

### Direction

Make the user's next action the dominant signal.

Suggested hierarchy:
1. Resume / create action,
2. recent work,
3. model discovery,
4. secondary discovery.

The welcome message should support the workflow, not become the primary content block on every visit.

## Priority 8 — generators

This is the highest-value product surface.

### Strengths

- Model selection is already differentiated.
- Cost visibility exists.
- Reference workflows are product-specific.
- Image/video controls are separated appropriately.

### Opportunities

- Establish a clearer vertical progression:
  1. model,
  2. references,
  3. prompt,
  4. generation parameters,
  5. cost / CTA.
- Reduce visual competition between every subsection.
- Keep advanced controls quieter until needed.
- Make the generation CTA and cost summary visually persistent at the point of decision.
- Maintain the current rule that Auto never reveals the internal AI.

### Model picker

The current manual cover presentation is a strong direction.

Improve:
- reduce generic purple/fuchsia fallback styling,
- make metadata more readable,
- reduce micro-badges,
- make Auto visually premium but neutral,
- keep manual-model imagery as the strongest visual cue.

## Priority 9 — library, history, community

### Direction

These should feel like creative asset tools, not dashboard tables.

- Increase visual prominence of media.
- Reduce borders and nested containers.
- Normalize metadata placement.
- Use consistent media actions across library/history/community.
- Preserve original media ratios where practical.
- Make selection/action states obvious without covering the asset.

Community should remain the most expressive authenticated surface.

## Priority 10 — wallet, settings, admin

These are "Operate" surfaces.

They should be quieter than the creative studio:
- flatter,
- clearer,
- more typographic,
- less decorative.

Do not use the same visual intensity as generation/model surfaces.

Financial values, plan choices, transaction state, health state, and account security should rely on structure and semantic color, not glow.

## Motion audit

### Existing risk

There are broad transitions and decorative hover effects that can become inconsistent as the product grows.

### Motion system

Use a small motion vocabulary:

- instant / 80–120ms: press feedback and repeated micro-interactions,
- standard / 150–220ms: hover, selection, small expansion,
- emphasized / 220–320ms: modal/popover entrance and important spatial transition.

Rules:
- no `transition-all`,
- prefer transform + opacity,
- exits faster than entrances,
- no bounce-heavy motion,
- respect reduced motion,
- do not animate every navigation event or card.

## Responsive audit

Key priorities for mobile:

- generation CTA must remain easy to reach,
- configuration panels must not feel like an endless stack of identical cards,
- model picker overlays/popovers must fit viewport height,
- community modal must preserve media and actions,
- important text should not shrink below comfortable reading sizes,
- sidebar/menu overlays should remain fast and visually simple.

## Recommended redesign sequence

### Phase 1 — design foundation
- typography scale,
- spacing scale,
- surfaces,
- border/radius system,
- semantic colors,
- buttons,
- inputs,
- tabs,
- badges,
- overlays,
- motion tokens.

### Phase 2 — shell
- sidebar,
- navbar,
- page titles,
- global layout,
- dark/light token migration.

### Phase 3 — generators
- video generator,
- image generator,
- model picker,
- reference picker,
- prompt composer,
- cost/CTA hierarchy.

### Phase 4 — creative surfaces
- dashboard,
- library,
- history,
- community,
- model showcase.

### Phase 5 — commercial / account
- wallet / checkout,
- settings,
- authentication,
- admin.

### Phase 6 — landing
Use the mature design system from the application to refine the public site without making it look like the authenticated product.

### Phase 7 — motion and browser QA
- Emil motion pass,
- Playwright desktop/mobile verification when connected,
- Impeccable audit,
- final polish pass.

## Definition of "premium" for IA-conect

Premium should mean:

- fewer visual decisions, executed consistently,
- readable at a glance,
- high confidence around money and generation,
- strong generated media presentation,
- subtle depth,
- disciplined accent usage,
- high-quality interaction feedback,
- no unnecessary decoration,
- no generic AI-dashboard visual shortcuts.

The redesign should make IA-conect feel more intentional, not simply more styled.
