# 🔍 AUDITORIA V2 - FASE 3: INVESTIGAÇÃO DE ADAPTERS

## PROBLEMA CRÍTICO IDENTIFICADO

### Legacy Adapter Bridge (Atual)
```typescript
adapter_id: 'legacy:provider-wavespeed'
adapter_id: 'legacy:provider-atlas'  
adapter_id: 'legacy:provider-runware'
```

**O que funciona**:
- ✅ Bridge mapeia V2 capabilities → V1 GenerationMode
- ✅ Bridge chama `legacy.submitGeneration()` (V1)
- ✅ Bridge chama `legacy.checkStatus()` (V1)

**O que NÃO funciona**:
- ❌ `listModels()` - não descobrem catálogo real
- ❌ `getPrice()` - não obtêm preços reais
- ❌ `health()` - retorna UNKNOWN, não HEALTHY

### Impacto na Route Status Progression
```
DISCOVERED → MAPPED → PRICED → READY
    ↑          ↑        ↑        ↑
    |          |        |        └─ REQUER: runtime=HEALTHY + pricing=CURRENT + snapshot válido
    |          |        └─────────── REQUER: adapter.getPrice() retorna preço válido
    |          └────────────────── REQUER: adapter.listModels() valida provider_model_identifier
    └───────────────────────────── CRIADO: bootstrap cria routes com status DISCOVERED
```

**Resultado Atual**:
```
Routes criadas com status DISCOVERED
         ↓
Nunca chamam adapter.listModels() (não implementado)
         ↓
Nunca chegam a MAPPED
         ↓
Pricing fetcher tenta adapter.getPrice() (não implementado)
         ↓
Nunca chegam a PRICED
         ↓
Reconciler não pode marcar como READY
         ↓
Smart Router não encontra candidatos
         ↓
🚫 GERAÇÃO FALHA: "NO_READY_ROUTE_V2"
```

## ANÁLISE: POR QUE OS ADAPTERS LEGADOS NÃO FUNCIONAM

### 1️⃣ LegacyAdapterBridge Implementa Apenas:
```typescript
✅ isConfigured()     // ← Funciona
✅ health()           // ← Retorna UNKNOWN (não valida)
✅ submitGeneration() // ← Funciona (chama V1)
✅ checkGeneration()  // ← Funciona (chama V1)
✅ cancelGeneration() // ← Funciona (chama V1)

❌ listModels()       // ← NÃO IMPLEMENTADO
❌ getPrice()         // ← NÃO IMPLEMENTADO
❌ balance()          // ← NÃO IMPLEMENTADO
```

### 2️⃣ Consequência em PriceSyncService
```typescript
const adapter = routingV2AdapterRegistry.get(provider.adapter_id);

if (!adapter?.getPrice) {
  // ← AQUI! adapter.getPrice não existe
  // Pricing fetcher cai fora
  return null;
}

const price = await adapter.getPrice(provider, route.provider_model_identifier, route.capability_id);
// ← Nunca executa porque adapter.getPrice é undefined
```

### 3️⃣ Consequência em RouteReconciler
```typescript
const pricing = route.pricing_status;  // ← Permanece 'STALE' ou 'INVALID'
const runtime = route.runtime_status;  // ← Permanece 'UNKNOWN'

// Route status flow
if (pricing === 'CURRENT' && hasRetail && runtime === 'HEALTHY') {
  return 'READY';  // ← NUNCA acontece
}

// ← Fica em DISCOVERED ou MAPPED
```

## O QUE SERIA NECESSÁRIO PARA FUNCIONAR

### Opção A: Implementar V2 Adapters Reais
Para cada provider (WaveSpeed, Atlas, Runware):

```typescript
class WaveSpeedAdapterV2 implements RoutingV2ProviderAdapter {
  readonly adapter_id = 'wavespeed-v2';
  readonly provider_id = 'provider-wavespeed';

  async listModels(provider): Promise<RoutingV2CatalogModel[]> {
    // 1. Chamar API real de WaveSpeed
    const response = await fetch('https://api.wavespeed.ai/v1/models', {
      headers: { Authorization: `Bearer ${provider.secret}` }
    });
    
    // 2. Mapear resposta para interface V2
    const models = response.json();
    return models.map(m => ({
      provider_model_identifier: m.id,
      name: m.name,
      capabilities: m.capabilities || [],
    }));
  }

  async getPrice(provider, provider_model_identifier, capability_id): Promise<RoutingV2ProviderPrice> {
    // 1. Chamar API real de pricing de WaveSpeed
    const response = await fetch(`https://api.wavespeed.ai/v1/pricing/${provider_model_identifier}`, {
      headers: { Authorization: `Bearer ${provider.secret}` }
    });
    
    // 2. Retornar preço em formato V2
    const pricing = response.json();
    return {
      billing_config: {
        type: 'PER_GENERATION',
        currency: 'USD',
        price_per_generation: pricing.price_per_generation,
      },
      source: 'API_LIVE',
      fetched_at: new Date().toISOString(),
    };
  }

  async health(provider): Promise<RoutingV2ProviderHealth> {
    // 1. Chamar endpoint de health real
    try {
      const response = await fetch('https://api.wavespeed.ai/v1/health', {
        headers: { Authorization: `Bearer ${provider.secret}` }
      });
      
      // 2. Retornar status real
      if (response.ok) {
        return { status: 'HEALTHY', checked_at: new Date().toISOString() };
      }
    } catch (err) {
      return { status: 'UNAVAILABLE', checked_at: new Date().toISOString(), message: err.message };
    }
  }
}
```

### Opção B: Manter Legacy, Implementar Fallback V2
Criar "wrapper" que descobre modelos via chamada legada e pricing via fixtures com validação:

```typescript
class RoutingV2LegacyWrapper implements RoutingV2ProviderAdapter {
  async listModels(provider) {
    // Chamar legacy adapter para descobrir modelos
    const legacyModels = await legacy.listModels(provider_id);
    
    // Mapear para V2
    return legacyModels.map(m => ({
      provider_model_identifier: m.provider_model_identifier,
      name: m.name,
      capabilities: m.capabilities,
    }));
  }

  async getPrice(provider, provider_model_identifier, capability_id) {
    // Usar fixture como fallback, mas validar contra legacy
    const fixture = PROVIDER_PRICING_FIXTURES[provider.provider_id]?.[provider_model_identifier];
    
    if (!fixture) {
      throw new Error(`No pricing for ${provider_model_identifier}`);
    }
    
    return {
      billing_config: fixture,
      source: 'FIXTURE_VALIDATED',
      fetched_at: new Date().toISOString(),
    };
  }
}
```

## BLOQUEADOR ATUAL

**NÃO é possível implementar V2 adapters reais sem**:
1. ✅ URLs/endpoints reais das APIs (WaveSpeed, Atlas, Runware)
2. ✅ Credenciais/secrets para teste (API keys)
3. ✅ Documentação oficial de quais modelos cada provider suporta
4. ✅ Documentação de `provider_model_identifier` corretos

**Exemplo do que não sabemos**:
- WaveSpeed: Qual é o endpoint? Autenticação? Modelos suportados?
- Atlas: É "Atlas Cloud" mesmo? Qual URL? Qual endpoint de modelos?
- Runware: Qual é a URL real? Documentação de pricing?

## ALTERNATIVA PRAGMÁTICA (Sem Dados Reais de API)

### 1. Implementar RoutingV2LegacyWrapper
Que descobre modelos e preços via legacy com fallback para fixtures

### 2. Marcar Routes como READY Manualmente (Não Automático)
Via Admin endpoint especial que:
- Valida que adapter está configurado
- Valida que pricing fixture existe
- Força status para READY (assumindo que legacy funciona)

### 3. Deixar Smart Router Usar Apenas Routes READY
Geração funciona mas sem automação de descoberta/preço

## RECOMENDAÇÃO

**Para desbloquear V2 sem dados reais de API**:

1. ✅ Manter adapters legados
2. ✅ Implementar RoutingV2LegacyWrapper que descobre modelos via legacy
3. ✅ Usar fixtures validadas como pricing
4. ✅ Admin endpoint para marcar routes como READY manualmente
5. ✅ Smart Router seleciona apenas routes READY
6. ✅ Geração funciona end-to-end via legacy
7. ⏳ Quando documentação real de APIs chegar, substituir por V2 adapters

**Status**: BLOCKED esperando documentação de APIs reais dos providers

