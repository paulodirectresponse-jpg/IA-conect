# 🧪 Guia Prático de Testes - IA Conect Routing V2

**URL de Teste**: https://iaconnect.ia.br/

---

## 1️⃣ TESTE: Verificar Health do Sistema

```bash
curl -s https://iaconnect.ia.br/api/health | jq '.'
```

**Esperado**:
```json
{
  "status": "ok",
  "timestamp": "2026-09-19T18:44:38.564Z"
}
```

**✅ Passou?** Sistema respondendo.

---

## 2️⃣ TESTE: Bootstrap Providers

**Prerequisito**: Token admin válido (normalmente gerado após login como admin)

```bash
curl -X POST https://iaconnect.ia.br/api/admin/routing-v2/providers/bootstrap-core \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{}'
```

**Esperado**:
```json
{
  "success": true,
  "data": {
    "created": [
      "provider-wavespeed",
      "provider-atlas",
      "provider-runware"
    ],
    "existing": [],
    "failed": []
  }
}
```

**✅ Passou?** 3 provedores criados.

---

## 3️⃣ TESTE: Listar Providers

```bash
curl -s https://iaconnect.ia.br/api/admin/routing-v2/providers \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" | jq '.data'
```

**Esperado**:
```json
[
  {
    "provider_id": "provider-wavespeed",
    "name": "WaveSpeed",
    "status": "ACTIVE",
    "health_status": "UNKNOWN",
    "is_configured": false
  },
  {
    "provider_id": "provider-atlas",
    "name": "Atlas Cloud",
    "status": "ACTIVE",
    "health_status": "UNKNOWN"
  },
  {
    "provider_id": "provider-runware",
    "name": "Runware",
    "status": "ACTIVE",
    "health_status": "UNKNOWN"
  }
]
```

**✅ Passou?** 3 provedores listados com status ACTIVE.

---

## 4️⃣ TESTE: Bootstrap Models

```bash
curl -X POST https://iaconnect.ia.br/api/admin/routing-v2/models/bootstrap-canonical \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{}'
```

**Esperado**:
```json
{
  "success": true,
  "data": {
    "created": 7,
    "existing": 0,
    "failed": 0
  }
}
```

**✅ Passou?** 7 modelos criados.

---

## 5️⃣ TESTE: Listar Models

```bash
curl -s https://iaconnect.ia.br/api/admin/routing-v2/models \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" | jq '.data | length'
```

**Esperado**: `7`

**✅ Passou?** 7 modelos listados.

---

## 6️⃣ TESTE: Bootstrap Routes

```bash
curl -X POST https://iaconnect.ia.br/api/admin/routing-v2/routes/bootstrap-canonical \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{}'
```

**Esperado**:
```json
{
  "success": true,
  "data": {
    "created": 15,
    "existing": 0,
    "failed": 0
  }
}
```

**✅ Passou?** 15 routes criadas.

---

## 7️⃣ TESTE: Sincronizar Preços

```bash
curl -X POST https://iaconnect.ia.br/api/admin/routing-v2/pricing/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"fx_rate_usd_brl": 5.0}'
```

**Esperado**:
```json
{
  "success": true,
  "data": {
    "checked_at": "2026-09-19T18:45:00.000Z",
    "processed": 15,
    "updated": 12,
    "failed": 3,
    "done": true
  }
}
```

**✅ Passou?** Preços sincronizados (alguns podem falhar se provedores não estão acessíveis, OK).

---

## 8️⃣ TESTE: Ver Readiness (Routes READY)

```bash
curl -s https://iaconnect.ia.br/api/admin/routing-v2/smart-router/readiness \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" | jq '.'
```

**Esperado**:
```json
{
  "success": true,
  "data": {
    "total_routes": 15,
    "ready": 3,
    "by_status": {
      "DISCOVERED": 12,
      "PRICED": 3,
      "READY": 0
    },
    "ready_routes": []
  }
}
```

**Nota**: Routes em DISCOVERED/PRICED → READY após pricing sync OK. Se falhar pricing, routes ficam em DISCOVERED.

**✅ Passou?** Routes em transição de status.

---

## 9️⃣ TESTE: Smart Router - Selecionar Route

```bash
curl -X POST https://iaconnect.ia.br/api/admin/routing-v2/smart-router/select \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "model_id": "model-flux-1-pro",
    "capability_id": "text-to-image"
  }'
```

**Esperado (com routes READY)**:
```json
{
  "success": true,
  "data": {
    "selected_route": {
      "route_id": "route-1",
      "model_id": "model-flux-1-pro",
      "capability_id": "text-to-image",
      "provider_id": "provider-wavespeed",
      "provider_model_identifier": "flux-1-pro",
      "retail_price_credits": 49,
      "runtime_status": "HEALTHY"
    },
    "available_routes": [
      { "route_id": "route-1", ... },
      { "route_id": "route-2", ... }
    ],
    "reason": "Selected provider-wavespeed/flux-1-pro (READY, 49 credits)"
  }
}
```

**✅ Passou?** Smart Router retorna route READY mais saudável.

---

## 🔟 TESTE: Geração Real (End-to-End)

```bash
# Fazer login primeiro (retorna AUTH_TOKEN)
# Depois:

curl -X POST https://iaconnect.ia.br/api/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -d '{
    "model_id": "model-flux-1-pro",
    "mode": "text-to-image",
    "prompt": "a beautiful landscape with mountains",
    "resolution": "512x512",
    "number_of_outputs": 1
  }'
```

**Esperado**:
```json
{
  "success": true,
  "data": {
    "generation_id": "gen-xxx",
    "status": "SUBMITTED",
    "model_id": "model-flux-1-pro",
    "routing_core_version": "V2",
    "provider_id": "provider-wavespeed",
    "estimated_credits": 49,
    "created_at": "2026-09-19T18:45:00.000Z"
  }
}
```

**Depois de alguns segundos** (polling):
```bash
curl -s https://iaconnect.ia.br/api/generations/{generation_id} \
  -H "Authorization: Bearer YOUR_USER_TOKEN" | jq '.data.status'
```

**Esperado**: `"SUCCEEDED"` ou `"COMPLETED"`

**✅ Passou?** Geração real executada via Routing V2!

---

## ❌ Troubleshooting

| Erro | Causa | Solução |
|------|-------|---------|
| `AUTH_SESSION_INVALID` | Token expirado | Faça login novamente |
| `ROUTING_V2_UNAVAILABLE` | Providers não bootstrapat | Execute bootstrap providers |
| `SMART_ROUTER_NO_READY` | Routes não em status READY | Sincronize preços e health |
| `PROVIDER_ERROR` | Provider offline | Verifique health do provider |

---

## 📊 Checklist de Validação

- [ ] API /health respondendo ✅
- [ ] Providers bootstrap OK
- [ ] 3 providers ACTIVE listados
- [ ] Models bootstrap OK
- [ ] 7 models ACTIVE listados
- [ ] Routes bootstrap OK
- [ ] 15 routes em DISCOVERED
- [ ] Pricing sync executado
- [ ] Routes em transição para READY
- [ ] Smart Router retornando routes
- [ ] Geração real executada via V2
- [ ] Créditos debitados corretamente
- [ ] Assets criados

---

## 🎯 Resultado Final

Se todos os testes passarem ✅:

**IA Conect Routing V2 está OPERACIONAL em produção!**

- Provedores funcionales
- Modelos disponíveis
- Routes prontas
- Smart Router selecionando
- Gerações reais via V2
- Economia e wallet funcionando

