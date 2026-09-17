# PR-20 — Known non-blocking build warnings

O build de referência pós-PR19 concluiu com sucesso, mas o minificador CSS reportou cinco warnings em seletores de classes utilitárias escapadas do tema claro (`bg-sky-*` / `border-sky-*`). Esses warnings são pré-existentes, não interrompem o build, não afetam os gates Lighthouse e não representam falha de typecheck/teste.

Na PR-20 eles são classificados como **não bloqueantes** para o rollout porque a correção exigiria reescrever seletores de compatibilidade visual fora do escopo de hardening final e poderia alterar a versão Stable. O critério de fechamento permanece: build, performance budget, testes e Browser Performance QA devem estar verdes.

Se o pipeline passar a promover esses warnings a erro ou se uma regressão visual for detectada, a correção deve ser tratada em manutenção posterior com validação visual dedicada, sem misturá-la ao rollout final.
