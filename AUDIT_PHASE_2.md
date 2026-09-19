# 🔍 AUDITORIA V2 - FASE 2: ANÁLISE PROFUNDA

## ACHADOS CRÍTICOS

### 1️⃣ ROUTE STATUS FLOW (Correto)
```
DISCOVERED → MAPPED → PRICED → READY
                ↓
            DEGRADED (se pricing stale ou runtime unknown)
```

Para uma Route chegar a **READY**, precisa de:
- ✅ `pricing_status === 'CURRENT'`
- ✅ `runtime_status === 'HEALTHY'`
- ✅ `pricing_snapshot.retail_price_credits > 0`
- ✅ `pricing_snapshot.valid_until > agora`

### 2️⃣ SMART ROUTER (Correto em Teoria)
```
1. Filtra Routes com status === 'READY'
2. Valida pricing snapshot (fresh e válido)
3. Calcula safe_cogs_brl
4. Ordena por: safe_cogs_brl DESC, priority DESC
5. Seleciona primeira
```

**MAS**: Não há routes READY porque:
- Pricing é fixtures (não real-time)
- Runtime health não valida APIs reais
- Provider adapters são todos `legacy:*`

### 3️⃣ PROBLEMA: LEGACY ADAPTER BRIDGE

```typescript
adapter_id: 'legacy:provider-wavespeed'  // ← NÃO é um adapter V2 real
```

**O que faz**:
- Mapeia capability V2 para GenerationMode V1
- Chama `legacy.submitGeneration()` (V1 antigo)
- **Não implementa** `listModels()`, `getPrice()` 

**Resultado**:
- Routes permanecem em status `DISCOVERED`
- Nunca chegam a `PRICED` (sem pricing real)
- Nunca chegam a `READY` (sem health real)
- Smart Router não tem candidatos

### 4️⃣ MODELOS COM PROBLEMAS COMPROVADOS

| Model ID | Problema | Comprovado? |
|----------|----------|------------|
| `model-flux-1-pro` | ✅ Flux 1 Pro é real | SIM ✓ |
| `model-stability-3.5-large` | ✅ Stability 3.5 é real | SIM ✓ |
| `model-openai-gpt-4o` | ❌ GPT-4o é LLM, não é gerador de áudio | NÃO ✗ |
| `model-falconsai-video-2` | ❌ FalconSAI não existe como produto público | NÃO ✗ |
| `model-atlas-video-gen` | ❌ Atlas Cloud pode não ter este serviço | INCERTO ⚠ |
| `model-runware-audio-turbo` | ❌ Runware pode não ter este modelo | INCERTO ⚠ |
| `model-runware-3d-gen` | ❌ Runware pode não ter 3D Gen | INCERTO ⚠ |

### 5️⃣ CAPABILITIES INCONSISTENTES

**GPT-4o**:
- Bootstrap: `text-to-audio` (SEM sentido - GPT-4o não gera áudio)
- Routes: `text-to-speech` (ainda errado)
- **Correto seria**: `text-to-text` (se mantido como fallback) OU remover

### 6️⃣ PRICING FIXTURES vs REAL

**Atual**:
```typescript
'flux-1-pro': { price_per_generation: 0.05 }  // ← Inventado
```

**Problema**:
- Não valida contra APIs reais
- PricingFetchService tenta chamar `adapter.getPrice()` mas todos os adapters são `legacy:*`
- Fixtures só são usados como fallback, não como realidade

**Resultado**:
- Routes ficam em `DISCOVERED`, nunca chegam a `PRICED`

## INVESTIGAÇÃO: O QUE FALTA

### ❌ Não há implementação de:

1. **WaveSpeed Adapter V2 Real**
   - Não há arquivo `wavespeedAdapterV2.ts`
   - Não há chamada real à API de WaveSpeed
   - Não há `listModels()`, `getPrice()`, `submitGeneration()` reais

2. **Atlas Adapter V2 Real**
   - Não há arquivo `atlasAdapterV2.ts`
   - Não há chamada real à API de Atlas
   - Não há implementação de métodos V2

3. **Runware Adapter V2 Real**
   - Não há arquivo `runwareAdapterV2.ts`
   - Não há chamada real à API de Runware
   - Não há implementação de métodos V2

### ❌ Documentação oficial não consultada:
- WaveSpeed API docs
- Atlas Cloud API docs
- Runware API docs
- Quais modelos cada um suporta realmente
- Quais são os `provider_model_identifier` reais
- Quais capabilities cada modelo suporta

## PLANO DE CORREÇÃO

### FASE 1: LIMPAR MODELOS NÃO COMPROVADOS
1. ❌ Remover `model-falconsai-video-2`
2. ❌ Remover `model-atlas-video-gen`
3. ❌ Remover `model-runware-audio-turbo`
4. ❌ Remover `model-runware-3d-gen`
5. ❌ Remover ou corrigir `model-openai-gpt-4o`

**Resultado**: 2-3 modelos comprovados apenas

### FASE 2: LIMPAR ROUTES NÃO COMPROVADAS
1. Remover todas as routes dos modelos deletados
2. Manter apenas routes de Flux + Stability com WaveSpeed/Atlas/Runware

**Resultado**: ~4 routes comprovadas

### FASE 3: IMPLEMENTAR ADAPTERS V2 REAIS
Para cada provider (WaveSpeed, Atlas, Runware):
1. Criar adapter V2 real (não legacy)
2. Implementar `health()` com chamada real à API
3. Implementar `listModels()` com descoberta real
4. Implementar `getPrice()` com preços reais
5. Implementar `submitGeneration()` com chamada real

### FASE 4: VALIDAR COM APIs REAIS
1. Testar health() contra cada provider
2. Listar modelos reais
3. Obter preços reais
4. Reconciliar routes com dados reais
5. Marcar como READY apenas se validado

### FASE 5: ATUALIZAR BOOTSTRAP
1. Remover modelos fictícios de `CANONICAL_MODELS`
2. Remover routes fictícias de `CANONICAL_ROUTES`
3. Apenas deixar dados comprovados

## BLOQUEADORES CONHECIDOS

1. **Não tenho acesso real às APIs dos providers**
   - WaveSpeed: Não sei se endpoint existe, qual é a autenticação
   - Atlas: Não sei se é mesmo "Atlas Cloud" ou outro produto
   - Runware: Não tenho credenciais ou documentação

2. **Não posso inventar dados**
   - Não posso assumir que `flux-1-pro` é o ID correto em WaveSpeed
   - Não posso assumir que `stability-3.5-large` existe em WaveSpeed
   - Não posso assumir preços sem verificar APIs

3. **Decisão necessária**
   - Qual é o plano com V1? (manter HYBRID ou migrar V2-only?)
   - Qual é o plano com providers sem adapters V2? (remover ou manter em legacy?)

