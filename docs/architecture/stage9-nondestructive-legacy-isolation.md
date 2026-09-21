# Etapa 9 — fechamento não destrutivo por isolamento do legado

## Decisão

O reset destrutivo da camada de IA não é requisito para o fechamento do IA Conect.

Os registros antigos podem permanecer armazenados desde que sejam comprovadamente inertes: eles não podem selecionar modelo, escolher provider, calcular preço, publicar catálogo, alimentar Auto, governar o Admin ou iniciar novas gerações.

O mecanismo de factory reset permanece no código apenas como contingência futura, protegido por habilitação explícita, token one-shot, snapshot, fingerprint, allowlist e confirmação textual.

## Autoridade operacional única

Routing V2 -> catálogo universal -> quote universal -> Auto/backend -> Smart Router -> geração -> Wallet/Ledger -> Asset -> History

## Estado do legado auditado

### DEAD_INERT — pode permanecer armazenado, mas não governa runtime
- provider scan/admin legado (providerScanRouter não montado)
- escrita manual antiga de provider_pricing
- aprovação antiga de provider_models
- telas antigas AdminProviders, AdminModels e AdminProviderScan (não montadas em AdminView)
- inventário V1 persistido em providers, models, provider_models, provider_pricing, desde que não seja reintroduzido como fonte operacional

### ACTIVE_REQUIRED fora da autoridade de IA
- catalogRepository continua necessário para promoções e feature flags. Isso não o torna fonte de verdade para provider/model/route de geração.

### TRANSITIONAL_REQUIRED
- legacyAdapterBridge e legacyWrapperAdapter continuam existindo como compatibilidade de execução para providers cujo adapter V2 ainda encapsula implementação antiga.
- isso não concede ao inventário V1 autoridade de seleção: a Route V2 já precisa ter sido escolhida antes do adapter ser chamado.
- o bloco legado em generationService permanece somente como referência de rollback inalcançável após o return routingV2ExecutionService.start(...).

## Provas estruturais

O guardrail server/routing-v2/legacyIsolationStage9.test.ts exige que:

1. providerScanRouter permaneça fora de server/routes/index.ts;
2. telas Admin V1 permaneçam fora de AdminView;
3. catálogo público leia routingV2CatalogService;
4. Auto leia somente modelos V2 + Routes READY;
5. pricing de geração use Router/Economics V2;
6. novas gerações retornem pelo executor V2 antes do bloco legado;
7. métricas de IA do Admin leiam routingV2Repository;
8. o factory reset permaneça somente como contingência protegida.

## Risco residual aceito

Sem reset destrutivo, documentos antigos continuam no Firestore. O risco residual é uma futura regressão voltar a montar endpoints/telas V1 ou importar esses dados como autoridade operacional.

A mitigação é estrutural:
- guardrails em CI;
- Admin de IA somente V2;
- catálogo público somente V2;
- Auto somente V2/READY;
- pricing operacional somente V2;
- execução nova somente Routing V2.

Qualquer alteração que viole essas condições deve falhar antes do fechamento/deploy.

## Critério de fechamento desta etapa

A Etapa 9 alternativa é considerada concluída quando:
- os guardrails de isolamento passam;
- nenhuma correção operacional adicional é necessária;
- o reset não é executado;
- os dados legados são tratados formalmente como inertes;
- a Parte B pode revisar as Etapas 1–10 sem depender de limpeza destrutiva do banco.