# PR-20 — Final QA / Rollout — Release Readiness

Baseline de fechamento: `main@cf1f3fe0a6da3af027dc2645e313329ddeb6355b` após PR-19.

## Decisão técnica de readiness

A PR-20 não cria uma nova arquitetura de produto. Ela fecha o ciclo PR-00 → PR-20 com contratos de regressão, evidência reproduzível de performance e uma matriz explícita de rollout/rollback. Stable continua sendo a experiência protegida; Beta permanece isolado por feature flags e kill switches.

## Evidência pré-PR20

CI pós-merge da PR-19: run `35220014922`, job `105197551222`, resultado `success`.

- Typecheck/lint: success.
- Production build: success.
- Performance budget: success.
- Testes: 75 arquivos, 353 testes, todos verdes.
- Bundle final: 82 chunks JS, 3493.9 KiB raw / 834.1 KiB gzip; 5 chunks CSS, 373.5 KiB raw / 59.2 KiB gzip.
- Chunk inicial do cliente: 235.6 KiB raw / 73.5 KiB gzip.
- Fast 3G: score 95, LCP 1987 ms, CLS 0.000, TBT 227 ms, Speed Index 1948 ms.
- 4G: score 99, LCP 1879 ms, CLS 0.000, TBT 0 ms, Speed Index 1802 ms.
- Derivados estáticos: ~20.1 MiB de fontes PNG → ~0.96 MiB WebP (-95%) / ~0.68 MiB AVIF (-97%).

`PERFORMANCE_BASELINE.md` permanece como registro histórico do estado anterior às otimizações; estes números representam o snapshot final de comparação.

## Matriz final de proteção

| Área | Fonte de verdade | Gate / proteção |
| --- | --- | --- |
| Stable | `src/App.tsx` + rotas atuais | não é redesenhado por Beta; lazy loading preservado |
| Entrada Beta | `beta.enabled` | desligar remove acesso à experiência Beta |
| Nova execução Beta | `beta.execution.enabled` | kill switch privado central |
| Flow Runtime | `beta.flow_runtime.execution` | kill switch privado de novas execuções |
| Economia de Flow | `beta.flow_economics.budget_guard` | proteção privada de orçamento |
| Modelos/providers | backend catalog/policy | frontend não recebe chaves nem roteamento interno |
| Créditos/preço | backend economics/pricing | servidor continua autoritativo |
| Assets/Library | repositórios existentes | ownership server-side; sem segunda biblioteca |
| Jobs/Tasks | Universal Jobs / Task Center | sem sistema paralelo de execução |
| Sharing | snapshot + token SHA-256 | read-only público, revogável, token bruto não persistido |
| Analytics | agregação dos repositórios existentes | sem IP, fingerprint ou tracking de terceiros |

## Rollout seguro

O rollout deve ser progressivo e reversível por flags existentes. A ordem recomendada é:

1. Manter Stable como fallback operacional durante todo o rollout.
2. Habilitar/observar superfícies read-only e organizacionais antes das superfícies que executam trabalho.
3. Habilitar criação/execução Beta apenas com `beta.execution.enabled` ativo e monitorado.
4. Habilitar Flow Runtime mantendo `beta.flow_runtime.execution` como rollback imediato.
5. Manter `beta.flow_economics.budget_guard` ativo quando Flow Economics estiver disponível.
6. Liberar Batch/Apps/Copilot/Sharing/Analytics somente após suas flags específicas estarem confirmadas.
7. Em regressão funcional, desabilitar primeiro a flag específica; em regressão transversal, desabilitar `beta.execution.enabled`; em regressão ampla de experiência, desabilitar `beta.enabled`.

Os one-shot release markers apenas promovem a flag na primeira liberação. Depois disso, o controle administrativo continua disponível por `toggleFlag`, com auditoria `FEATURE_FLAG_TOGGLED`.

## Contratos que bloqueiam regressão

`server/services/pr20ReleaseReadiness.test.ts` exige no CI:

- pipeline único com typecheck, build, bundle budget, testes e Lighthouse Fast 3G + 4G;
- rotas Stable preservadas e Beta isolado;
- presença dos kill switches críticos;
- release markers + toggle administrativo auditável;
- Sharing público somente leitura, revogável e com hash SHA-256;
- permanência das suítes de economia, concorrência, ownership e idempotência;
- safeguards mobile e `prefers-reduced-motion`.

## Critério de fechamento

PR-20 só pode ser considerada finalizada após:

1. CI completo da PR verde;
2. squash merge para `main`;
3. confirmação do novo SHA de `main`;
4. CI pós-merge verde, incluindo Browser Performance QA Fast 3G + 4G.
