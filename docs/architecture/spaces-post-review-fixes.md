# Spaces — pós-revisão das Etapas 1–8

## Correções aplicadas

### Execução seletiva
- NODE e DOWNSTREAM agora concluem pela fronteira ativa da execução, sem esperar OUTPUT nodes fora de `active_node_ids`.
- A conclusão foi extraída para `flowExecutionCompletion.ts` e coberta por testes comportamentais.
- FULL continua usando o mesmo runtime e produzindo outputs pelos nodes terminais ativos.

### Concorrência no frontend
- Enquanto `run.status === RUNNING`, ações de gerar, executar daqui e executar tudo permanecem bloqueadas.
- O backend não ganhou um bloqueio global novo para não quebrar a semântica de idempotência/economia existente.

### Cache reutilizado
- Node runs reaproveitados recebem `reused_from_run_id`.
- O timestamp original da criação é preservado.
- Runs reaproveitados não entram como novas criações no histórico visual, na Home ou na seleção do próximo cache.
- O custo novo continua zero para outputs reaproveitados.

### Histórico de um Space
- A leitura deixou de buscar os últimos runs globais do usuário para depois filtrar.
- Agora `listFlowRuns` consulta diretamente por `flow_id`, evitando truncamento quando o usuário acumula muitos runs em outros Spaces.

## Limitações conscientemente adiadas

### Resumo visual da Home
A Home ainda usa `listUserNodeRuns(userId, 500)` para montar capas recentes. Isso é um resumo visual, não autoridade de execução ou cobrança.

Trocar isso agora por uma consulta por Space criaria padrão N+1 e poderia piorar custo/latência. Uma solução definitiva deve usar índice/consulta ordenada apropriada ou materialização de resumo visual por Flow. Até lá:
- execução permanece correta;
- histórico individual permanece correto;
- no pior caso de usuários com volume muito alto, a capa da Home pode não refletir um output muito antigo fora da janela de 500 node runs.

### Concorrência multi-aba
O frontend bloqueia novas execuções enquanto a execução atual está RUNNING. Um bloqueio transacional cross-tab/backend deve ser implementado apenas junto de uma estratégia idempotente explícita para não conflitar com retries e bindings econômicos.
