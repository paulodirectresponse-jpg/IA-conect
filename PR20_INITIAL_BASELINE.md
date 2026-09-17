# PR-20 — Final QA / Rollout — Initial Baseline

Base: `main@cf1f3fe0a6da3af027dc2645e313329ddeb6355b`

Status: **initial only**. Nenhuma alteração de rollout, feature flag, arquitetura de produto ou comportamento de produção foi aplicada nesta etapa.

## Objetivo

Preparar a fase final de hardening e rollout do IA Conect após as PRs 00–19, sem criar nova arquitetura paralela e sem reabrir escopo de produto já concluído.

## Fonte nativa de QA

A fonte de verdade da PR-20 continuará sendo o próprio sistema do IA Conect, principalmente `.github/workflows/ci.yml`:

- lint/typecheck;
- production build;
- bundle analysis;
- performance budget;
- testes do repositório, arquitetura e contratos;
- Browser Performance QA — Fast 3G + 4G;
- artifacts de performance.

Não será usado TinyFish nem uma plataforma externa de QA paralela.

## Baseline herdado

A PR-19 foi squash merged em `main@cf1f3fe0a6da3af027dc2645e313329ddeb6355b`.

CI pós-merge de referência:

- run: `35220014922`;
- job: `105197551222`;
- resultado: success;
- lint/typecheck: success;
- build: success;
- performance budget: success;
- testes: success;
- Browser Performance QA Fast 3G + 4G: success.

## Pontos identificados na análise inicial

1. `FINAL_VISUAL_QA.md` ainda registra que o Browser QA com Playwright MCP estaria pendente. Essa nota está desatualizada em relação ao pipeline atual, que já executa Browser Performance QA Fast 3G + 4G no próprio CI.
2. `PERFORMANCE_BASELINE.md` preserva um baseline histórico anterior às otimizações. Na PR-20 completa, ele deve continuar como histórico, mas receber uma comparação final com o estado atual em vez de ser sobrescrito.
3. O pipeline atual já contém os gates essenciais de build, testes e performance; a PR-20 deve consolidar e ampliar a matriz de validação, não criar uma segunda infraestrutura de QA.

## Checklist da PR-20 completa — ainda não executado

- validar rotas e fluxos Stable: auth, criação, wallet, history, settings, admin, community e library;
- validar todas as superfícies Beta e seus feature flags/kill switches;
- revalidar que provider IDs, chaves e roteamento interno não vazam para o frontend;
- revalidar pricing/créditos server-authoritative;
- revalidar ownership, idempotência e isolamento de dados;
- validar privacidade, revogação e read-only de Sharing;
- validar desktop/mobile, reduced motion e acessibilidade;
- comparar bundle final e artifacts Lighthouse com os baselines históricos;
- consolidar matriz de rollout/rollback e ordem segura de flags;
- atualizar documentação final de QA/performance;
- produzir relatório de release readiness antes de qualquer decisão de rollout.

## Regra para o próximo passo

A PR-20 só deve avançar para implementação, QA completo, abertura de PR e rollout quando houver comando explícito para continuar/finalizar esta fase.
