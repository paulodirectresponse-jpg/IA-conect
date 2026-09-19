# Routing Core V2 — bootstrap greenfield

O Routing Core V2 passa a ser construído do zero. O V1 não é mais fonte de importação de inventário.

## O que é reaproveitado

- autenticação e usuários;
- Wallet/ledger;
- Universal Jobs;
- Universal Assets e storage;
- histórico universal;
- adapters de execução que forem tecnicamente reutilizáveis.

## O que nasce limpo no V2

- Providers;
- Models;
- Routes;
- Billing configuration;
- pricing snapshots;
- health/runtime state;
- readiness/cutover.

## Preview isolado

Worker: `ia-conect-routing-v2-preview`.

O preview mantém `ROUTING_V2_PREVIEW=true`, não possui cron e bloqueia `V2_ONLY`.

## Reset do inventário V2

No Admin → Routing V2 → Health existe **Resetar inventário V2 (preview)**.

O endpoint exige autenticação ADMIN, confirmação explícita e só funciona quando `ROUTING_V2_PREVIEW=true`.

Ele apaga exclusivamente:
- `routing_v2_providers`;
- `routing_v2_models`;
- `routing_v2_routes`;
- pricing settings V2;
- cursor de sync V2;
- estado de cutover V2.

Ao final, recria o estado de cutover como `HYBRID`.

Nenhuma coleção V1, usuário, Wallet, Job, Asset, histórico ou arquivo é apagado.

## Bootstrap limpo

1. Resetar o inventário V2 no preview.
2. Cadastrar providers V2 curados.
3. Cadastrar models canônicos V2.
4. Criar Routes por model + capability + provider + provider_model_identifier.
5. Configurar billing/pricing por Route.
6. Executar health/pricing reconciliation.
7. Validar Routes READY.
8. Testar Jobs reais em HYBRID.
9. Somente após cobertura completa, planejar V2_ONLY.
10. Depois do cutover operacional validado, remover o routing/pricing V1 que ficar sem uso.
