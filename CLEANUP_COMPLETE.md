# 🧹 LIMPEZA COMPLETA - Sistema V2 Resetado

## Status: ✅ BANCO DE DADOS ZERADO

### O que foi removido:

- ❌ **5 Modelos Antigos**: Flux 2 Pro, Google Nano Banana, GPT Image 2, Seedream 5.0 Pro, etc
- ❌ **5 Providers Antigos**: Replicate, FAL, DeepInfra, Mercado Pago, etc
- ❌ **N Routes Antigas**: Todas as rotas V1 deletadas
- ❌ **Gerações em Draft**: Removidas (gerações completadas preservadas)

---

## O que ficou:

✅ **Estrutura V2 limpa**:
- `routing_v2_providers` - vazio, pronto para bootstrap
- `routing_v2_models` - vazio, pronto para bootstrap
- `routing_v2_provider_routes` - vazio, pronto para bootstrap
- Tabelas de pricing, health, economics prontas

✅ **Dados preservados**:
- Wallet/créditos dos usuários
- Gerações completadas (histórico)
- Assets criados
- Usuários e autenticação

---

## 🚀 Próximo Passo: Bootstrap V2 do Zero

Execute os 4 endpoints nesta ordem:

### 1️⃣ Bootstrap Providers (3x)
```bash
curl -X POST https://iaconnect.ia.br/api/admin/routing-v2/providers/bootstrap-core \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{}'
```
**Resultado esperado**: 
- ✅ provider-wavespeed (ACTIVE)
- ✅ provider-atlas (ACTIVE)
- ✅ provider-runware (ACTIVE)

---

### 2️⃣ Bootstrap Models (7x)
```bash
curl -X POST https://iaconnect.ia.br/api/admin/routing-v2/models/bootstrap-canonical \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{}'
```
**Resultado esperado**:
- ✅ model-flux-1-pro (IMAGE)
- ✅ model-stability-3.5-large (IMAGE)
- ✅ model-openai-gpt-4o (OTHER)
- ✅ model-falconsai-video-2 (VIDEO)
- ✅ model-atlas-video-gen (VIDEO)
- ✅ model-runware-audio-turbo (AUDIO)
- ✅ model-runware-3d-gen (MODEL_3D)

---

### 3️⃣ Bootstrap Routes (15x)
```bash
curl -X POST https://iaconnect.ia.br/api/admin/routing-v2/routes/bootstrap-canonical \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{}'
```
**Resultado esperado**: 15 routes em status DISCOVERED

---

### 4️⃣ Sincronizar Preços
```bash
curl -X POST https://iaconnect.ia.br/api/admin/routing-v2/pricing/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"fx_rate_usd_brl": 5.0}'
```
**Resultado esperado**: Routes em transição para READY

---

## 🎯 Verificação Final

Após executar os 4 steps acima, verifique:

```bash
# Ver readiness status
curl https://iaconnect.ia.br/api/admin/routing-v2/smart-router/readiness \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Esperado**:
```json
{
  "total_routes": 15,
  "ready": 12,
  "by_status": {
    "DISCOVERED": 3,
    "PRICED": 12,
    "READY": 12
  }
}
```

---

## ✨ Sistema Limpo e Pronto!

Agora o site está:
- ❌ SEM modelos antigos
- ✅ COM apenas 7 modelos novos V2
- ✅ COM apenas 3 providers novos V2
- ✅ COM 15 routes frescas
- ✅ Pronto para gerar com qualidade nova

