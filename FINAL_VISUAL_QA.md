# Final Visual QA — IA Connect

## Scope

Final source-level and CI-backed QA pass after the Stable redesign, mobile hardening and Beta PR-00 → PR-20 roadmap.

Validated by repository contracts and the native CI pipeline:

- semantic design tokens and shell hierarchy;
- image/video generators and model picker;
- Dashboard, Community, Library, Wallet, History, Settings and Admin;
- auth/public landing surfaces;
- Stable/Beta isolation;
- reduced-motion behavior;
- mobile layout safeguards;
- dark/light Stable compatibility;
- typecheck, production build, tests and performance budget;
- Browser Performance QA under Fast 3G and 4G.

## Motion and accessibility

- Shared motion durations remain restrained.
- `prefers-reduced-motion` disables or collapses decorative motion where required.
- Focus-visible treatment remains present for interactive controls.
- Financial and generation states retain textual meaning instead of relying only on color.
- AUTO model mode stays generic and does not expose provider routing.
- Generated media remains the primary visual hierarchy.

## Responsive

Repository QA contracts cover the mobile shell, Dashboard, Library and final mobile stage safeguards. The final layout keeps desktop behavior isolated from mobile-specific adaptations and preserves reachability of primary generation actions.

## Browser Performance QA status

Browser QA is no longer pending on an external Playwright MCP server. The repository CI itself is the authoritative automated browser gate.

The workflow `.github/workflows/ci.yml` builds the production bundle, starts the Vite preview and runs Lighthouse twice:

- Fast 3G simulation: RTT 150 ms, throughput 1600 Kbps, CPU slowdown 4x;
- 4G simulation: RTT 40 ms, throughput 9000 Kbps, CPU slowdown 2x.

Reference post-PR19 run (`main@cf1f3fe0a6da3af027dc2645e313329ddeb6355b`):

| Profile | Score | LCP | CLS | TBT | Speed Index |
| --- | ---: | ---: | ---: | ---: | ---: |
| Fast 3G | 95 | 1987 ms | 0.000 | 227 ms | 1948 ms |
| 4G | 99 | 1879 ms | 0.000 | 0 ms | 1802 ms |

These synthetic measurements are release gates, not a substitute for real-user p75 field metrics.

## Functional coverage

Stable regressions remain protected by existing architecture, economics, storage, mobile and route suites. Beta regressions are protected per capability/module, including Universal Assets, Library, Catalog, Audio, 3D, Image Editor, Video, Flows, Flow Runtime/Economics, Templates, Workflow Apps, Batch, Context/Copilot and Sharing/Analytics.

The PR-20 release-readiness contract additionally verifies that these protections and the CI gates remain wired before rollout.

## Design outcome

The product keeps one hierarchy:

1. generated media and primary task;
2. prompt/model/configuration;
3. financial/generation truth;
4. navigation and operational context;
5. secondary discovery.

Decorative gradients, glows and card nesting remain intentionally restrained outside brand, media and primary-action moments.
