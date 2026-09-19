# Routing Core V2 — preview isolado para migração real

Este fluxo existe para testar a migração real V1 → V2 sem mergear a PR #114 e sem substituir o Worker de produção.

## Garantias

- Worker separado: `ia-conect-routing-v2-preview`.
- Branch exigido pelo workflow: `routing-core-v2`.
- Deploy somente manual (`workflow_dispatch`).
- Sem cron no preview.
- `ROUTING_V2_PREVIEW=true`.
- `V2_ONLY` é bloqueado no backend quando o preview está ativo.
- A migração é bloqueada se o estado persistido não estiver em `HYBRID`.
- A migração é aditiva: escreve somente nas coleções V2 e não remove inventário V1.

## Segredos necessários no repositório (GitHub Actions)

- `CLOUDFLARE_API_TOKEN`: token com permissão para Workers Scripts no account do IA Conect.
- `CLOUDFLARE_ACCOUNT_ID`: account id do Cloudflare.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: mesma service account autorizada a ler o inventário V1 e gravar as coleções V2.

O workflow valida esses três nomes antes do deploy e informa exatamente qual estiver ausente. Nenhum segredo deve ser commitado no repositório.

## Deploy

Abra Actions → **Routing V2 isolated preview** → Run workflow no branch `routing-core-v2`.

No campo de confirmação, digite exatamente:

`DEPLOY_ROUTING_V2_PREVIEW`

O workflow executa lint, testes e build antes de publicar o Worker isolado.

## Teste operacional

1. Abra o domínio `workers.dev` gerado para `ia-conect-routing-v2-preview`.
2. Faça login com uma conta ADMIN do IA Conect.
3. Em Admin → Routing V2 → Health, confirme `HYBRID`.
4. Consulte a auditoria de migração.
5. Execute **Migrar inventário V1 → V2** uma única vez.
6. Rode novamente a auditoria e registre:
   - providers criados/existentes/pulados;
   - models criados/existentes/pulados;
   - routes criadas/existentes/puladas;
   - routes com preço V1 verificado;
   - routes pendentes de preço;
   - cobertura READY por model-capability.
7. Não ativar `V2_ONLY`. O preview também bloqueia essa ação no backend.

## Endpoints úteis

- `GET /api/admin/routing-v2/cutover`
- `GET /api/admin/routing-v2/migration/audit`
- `POST /api/admin/routing-v2/migration/run`
- `GET /api/admin/routing-v2/health`
- `POST /api/admin/routing-v2/pricing/sync`

Todos exigem autenticação ADMIN normal.

## Encerramento do preview

Depois da validação, o Worker `ia-conect-routing-v2-preview` pode ser removido sem afetar o Worker principal. Os dados V2 migrados permanecem no Firestore real para continuação do rollout em HYBRID.


## Observação sobre Retry build

Depois de alterar o Production branch no Cloudflare, não reutilizar um build antigo com Retry build: o retry mantém o snapshot/branch original daquele build. Um novo commit em `routing-core-v2` deve disparar um build novo já com o branch correto.
