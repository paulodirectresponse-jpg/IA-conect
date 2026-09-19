# IA Conect - Configuração de Provedores, Modelos e Routes

## 🏗️ Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────┐
│                    IA Conect Platform                        │
├─────────────────────────────────────────────────────────────┤
│  User → [Auth] → App → [Routing V2] → [Smart Router]       │
│                            ↓                                 │
│                    Select READY Route                        │
│                            ↓                                 │
│    Provider (WaveSpeed / Atlas / Runware)                   │
│            ↓                                                 │
│    [Health Check] → [Pricing] → [Generation]               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 1. PROVEDORES (Providers)

### Estrutura no Banco de Dados

```typescript
interface RoutingV2Provider {
  provider_id: string;           // Identificador único (ex: "provider-wavespeed")
  name: string;                  // Nome amigável (ex: "WaveSpeed AI")
  slug: string;                  // URL-safe (ex: "wavespeed")
  adapter_id: string;            // Referência ao adapter (ex: "wavespeed-v3")
  status: 'ACTIVE' | 'INACTIVE' | 'DEGRADED';
  priority: number;              // Ordem de preferência (1-100)
  is_configured: boolean;        // Se está pronto para uso
  health_status: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'UNKNOWN';
  last_health_check_at: string;  // ISO timestamp
  created_at: string;
  updated_at: string;
}
```

### 3 Provedores Configurados

#### 1️⃣ **WaveSpeed AI**
```
Provider ID: provider-wavespeed
Name: WaveSpeed
Status: ACTIVE
Adapter: wavespeed-v3
Priority: 1 (maior prioridade)
API Base: https://api.wavespeed.ai
Health Check: GET /api/v3/predictions?limit=1
  → 200 = HEALTHY
  → 401/403 = UNAVAILABLE (credenciais)
  → 429/5xx = DEGRADED (rate limit/erro)

Modelos suportados:
  - Flux 1 Pro (image generation)
  - Stability 3.5 (image generation)
  - GPT-4o (text to speech)
  - FalconSAI Video 2 (video generation)
```

#### 2️⃣ **Atlas Cloud**
```
Provider ID: provider-atlas
Name: Atlas Cloud
Status: ACTIVE
Adapter: atlas-cloud-v1
Priority: 2
API Base: https://api.atlascloud.ai
Health Check: GET /api/v1/predictions?limit=1
  → 200 = HEALTHY
  → 401/403 = UNAVAILABLE
  → 429/5xx = DEGRADED

Modelos suportados:
  - Atlas Image Gen (image generation)
  - Atlas Video Gen (video generation)
```

#### 3️⃣ **Runware**
```
Provider ID: provider-runware
Name: Runware
Status: ACTIVE
Adapter: runware-v1
Priority: 3
API Base: https://api.runware.ai/v1
Health Check: POST /api/status (custom query)
  → 200 = HEALTHY
  → 401/403 = UNAVAILABLE
  → 429/5xx = DEGRADED

Modelos suportados:
  - Flux 1 Pro (image generation)
  - FalconSAI Video 2 (video generation)
  - Runware Audio Turbo (audio generation)
  - Runware 3D Gen (3D model generation)
```

### Bootstrap de Provedores

```bash
POST /admin/routing-v2/providers/bootstrap-core
```

Cria os 3 provedores com status ACTIVE e inicia health checks automáticos.

---

## 🎯 2. MODELOS (Models)

### Estrutura no Banco de Dados

```typescript
interface RoutingV2Model {
  model_id: string;              // Único (ex: "model-flux-1-pro")
  name: string;                  // Amigável (ex: "Flux 1 Pro")
  vendor: string;                // Fabricante (ex: "Black Forest Labs")
  category: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'MODEL_3D' | 'OTHER';
  description: string;
  capabilities: CapabilityId[];  // Ex: ["text-to-image"]
  status: 'ACTIVE' | 'INACTIVE' | 'EXPERIMENTAL';
  created_at: string;
  updated_at: string;
}
```

### 7 Modelos Canônicos

| # | Model ID | Name | Categoria | Vendor | Capability |
|---|----------|------|-----------|--------|------------|
| 1 | model-flux-1-pro | Flux 1 Pro | IMAGE | Black Forest Labs | text-to-image |
| 2 | model-stability-3.5-large | Stability 3.5 Large | IMAGE | Stability AI | text-to-image |
| 3 | model-openai-gpt-4o | GPT-4o | OTHER | OpenAI | text-to-speech |
| 4 | model-falconsai-video-2 | FalconSAI Video 2 | VIDEO | FalconSAI | text-to-video |
| 5 | model-atlas-video-gen | Atlas Video Gen | VIDEO | Atlas Cloud | text-to-video |
| 6 | model-runware-audio-turbo | Runware Audio Turbo | AUDIO | Runware | text-to-speech |
| 7 | model-runware-3d-gen | Runware 3D Gen | MODEL_3D | Runware | text-to-3d |

### Bootstrap de Modelos

```bash
POST /admin/routing-v2/models/bootstrap-canonical
```

Cria os 7 modelos com status ACTIVE (sem duplicação entre provedores).

---

## 🔀 3. ROUTES (Mapeamentos)

### Estrutura no Banco de Dados

```typescript
interface RoutingV2ProviderRoute {
  route_id: string;                    // Único
  model_id: string;                    // Referência ao modelo
  capability_id: CapabilityId;         // Ex: "text-to-image"
  provider_id: string;                 // Referência ao provedor
  provider_model_identifier: string;   // ID do modelo no provider (ex: "flux-1-pro")
  status: 'DISCOVERED' | 'MAPPED' | 'PRICED' | 'READY' | 'DEGRADED' | 'DISABLED';
  pricing_status: 'UNKNOWN' | 'CURRENT' | 'STALE' | 'INVALID';
  runtime_status: 'UNKNOWN' | 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
  billing_config: RoutingV2BillingConfig;  // Tipo de cobrança
  pricing_snapshot?: RoutingV2PriceSnapshot; // Preço + economia
  metrics?: RoutingV2RouteMetrics;     // Sucesso, latência, etc
}
```

### Lifecycle de Route

```
┌─────────────┐
│ DISCOVERED  │  ← Rota criada, não validada
└──────┬──────┘
       │ (Health check OK + Pricing fetch)
       ↓
┌─────────────┐
│   MAPPED    │  ← Provider health OK, identidade validada
└──────┬──────┘
       │ (Pricing fetch OK)
       ↓
┌─────────────┐
│  PRICED     │  ← Preço obtido e válido
└──────┬──────┘
       │ (Economics OK + Provider HEALTHY)
       ↓
┌─────────────┐
│   READY     │  ← ✅ PRONTA PARA GERAR
└─────────────┘
       ↑
       │ (Se health degradar ou pricing expirar)
       │
┌──────┴──────┐
│  DEGRADED   │  ← Provider em degradação
└─────────────┘
```

### 15 Routes Criadas

#### Flux 1 Pro (2 rotas)
```
Route 1: model-flux-1-pro / text-to-image / provider-wavespeed / "flux-1-pro"
Route 2: model-flux-1-pro / text-to-image / provider-runware / "flux-1-pro"
```

#### Stability 3.5 Large (2 rotas)
```
Route 3: model-stability-3.5-large / text-to-image / provider-wavespeed / "stability-3.5-large"
Route 4: model-stability-3.5-large / text-to-image / provider-atlas / "atlas-image-gen"
```

#### GPT-4o (1 rota)
```
Route 5: model-openai-gpt-4o / text-to-speech / provider-wavespeed / "gpt-4o"
```

#### FalconSAI Video 2 (2 rotas)
```
Route 6: model-falconsai-video-2 / text-to-video / provider-wavespeed / "falconsai-video-2"
Route 7: model-falconsai-video-2 / text-to-video / provider-runware / "falconsai-video-2"
```

#### Atlas Video Gen (1 rota)
```
Route 8: model-atlas-video-gen / text-to-video / provider-atlas / "atlas-video-gen"
```

#### Runware Audio (1 rota)
```
Route 9: model-runware-audio-turbo / text-to-speech / provider-runware / "runware-audio-turbo"
```

#### Runware 3D (1 rota)
```
Route 10: model-runware-3d-gen / text-to-3d / provider-runware / "runware-3d-gen"
```

### Bootstrap de Routes

```bash
POST /admin/routing-v2/routes/bootstrap-canonical
```

Cria as 15 routes com:
- Status inicial: DISCOVERED
- Billing config: PER_GENERATION em USD (padrão)
- Health propagado do provider

---

## 💰 4. PRICING

### Tipos de Cobrança Suportados

```typescript
type RoutingV2BillingConfig = 
  | { type: 'PER_GENERATION'; currency: 'USD' | 'BRL'; price_per_generation: number }
  | { type: 'PER_OUTPUT'; currency: 'USD' | 'BRL'; price_per_output: number }
  | { type: 'PER_SECOND'; currency: 'USD' | 'BRL'; price_per_second: number }
  | { type: 'PER_MINUTE'; currency: 'USD' | 'BRL'; price_per_minute: number }
  | { type: 'PER_CHARACTER'; currency: 'USD' | 'BRL'; price_per_unit: number; characters_per_unit: number }
  | { type: 'FIXED_MATRIX'; entries: Array<{match: Record<string,any>; price: number}> }
  | { type: 'CUSTOM_FORMULA'; formula_id: string; parameters?: Record<string,any> }
```

### Pricing Fixture (Demo)

```javascript
// WaveSpeed
model-flux-1-pro:        $0.05 / generation
model-stability-3.5:     $0.02 / generation
model-gpt-4o:           $0.000002 / character (1 char = 1 unit)
model-falconsai-video-2: $0.10 / second

// Atlas
model-atlas-image-gen:   $0.03 / generation
model-atlas-video-gen:   $0.15 / second

// Runware
model-flux-1-pro:        $0.045 / generation (mais barato que WaveSpeed)
model-falconsai-video-2: $0.12 / second
model-runware-audio:     $0.000015 / character
model-runware-3d:        $0.50 / generation
```

### Sincronização de Preços

```bash
POST /admin/routing-v2/pricing/sync
Body: { "fx_rate_usd_brl": 5.0 }
```

1. Busca preço real de cada adapter (`routingV2PricingFetchService.fetchProviderPrice`)
2. Se adapter não responde → usa fixture (`routingV2PricingFixtureService`)
3. Calcula economia: provider_cost → FX → safety_buffer → safe_cogs_brl → margem → BRL → créditos
4. Persiste em `pricing_snapshot`
5. Reconcilia route status → PRICED se OK

### Fórmula de Economia

```
provider_cost_usd = 0.05

↓ (FX conversion)
provider_cost_brl = 0.05 × 5.0 = R$0.25

↓ (Safety buffer 5%)
safe_cogs_brl = 0.25 × 1.05 = R$0.2625

↓ (Target margin 40%)
retail_price_brl = 0.2625 / (1 - 0.40) = R$0.4375

↓ (Credit value 0.009 BRL/credit)
retail_credits = 0.4375 / 0.009 = 48.6 créditos (~49 créditos)
```

---

## 🎯 5. SMART ROUTER

### Seleção de Route

```bash
POST /admin/routing-v2/smart-router/select
Body: {
  "model_id": "model-flux-1-pro",           // Opcional
  "capability_id": "text-to-image",          // Opcional
  "preferred_provider_ids": ["provider-atlas"], // Opcional
  "avoid_degraded": true                     // Opcional
}
```

### Algoritmo de Seleção

1. **Filtra READY routes apenas** (invariante: não usa DISCOVERED/MAPPED/PRICED)
2. **Aplica filtros**:
   - model_id (se fornecido)
   - capability_id (se fornecido)
3. **Aplica preferência de provider** (se fornecido)
4. **Evita degraded** (se solicitado)
5. **Ordena por**:
   - HEALTHY > DEGRADED (health first)
   - Menor preço (cheaper first)
   - Provider alfabético (determinismo)

### Exemplo

```
Entrada: model_id="model-flux-1-pro"

Rotas READY:
- Route 1: WaveSpeed, HEALTHY, $0.05 → 49 créditos ✓
- Route 2: Runware, DEGRADED, $0.045 → 45 créditos

Seleção: Route 1 (WaveSpeed é HEALTHY, mesmo sendo mais caro)

Resposta:
{
  "selected_route": {
    "route_id": "route-1",
    "model_id": "model-flux-1-pro",
    "provider_id": "provider-wavespeed",
    "retail_price_credits": 49,
    "runtime_status": "HEALTHY"
  },
  "available_routes": [Route 1, Route 2],
  "reason": "Selected provider-wavespeed/flux-1-pro (READY, 49 credits)"
}
```

---

## 🔄 6. RECONCILIAÇÃO

### Condição de READY

Uma route entra em status READY quando TODAS as condições são atendidas:

```typescript
const isReady = 
  route.pricing_status === 'CURRENT' &&          // Preço atualizado
  route.runtime_status === 'HEALTHY' &&          // Provider saudável
  route.pricing_snapshot !== null &&             // Snapshot econômico existe
  route.pricing_snapshot.retail_price_credits > 0 && // Crédito positivo
  route.billing_config.type !== 'UNKNOWN' &&     // Tipo de cobrança conhecido
  route.status !== 'DISABLED'                    // Não desabilitada manualmente
```

### Estado Degradado

Route vai para DEGRADED quando:
- Provider health check retorna DEGRADED/UNAVAILABLE
- Pricing expira (> 90 minutos)
- Créditos negativos (erro econômico)
- Billing config inválida

---

## 🚀 7. FLUXO COMPLETO DE GERAÇÃO

```
User clica "Gerar"
    ↓
[Busca modelo no request]
    ↓
Smart Router.select({model_id: "model-flux-1-pro"})
    ↓
Retorna Route READY mais saudável
    ↓
Extrai provider_id, provider_model_identifier, billing_config
    ↓
Busca credenciais do provider (env vars)
    ↓
Cria universalGeneration (status: DRAFT)
    ↓
Submete para provider via adapter (via routing V2)
    ↓
Provider retorna provider_job_id
    ↓
Atualiza generation (status: SUBMITTED)
    ↓
Polling: provider_job_id → status
    ↓
Quando completo: resultado_url
    ↓
Cria universalAsset com resultado
    ↓
Atualiza generation (status: SUCCEEDED)
    ↓
Deduz créditos da wallet
    ↓
Retorna asset_id ao user
```

---

## 📊 8. ENDPOINTS ADMIN

| Método | Path | Função |
|--------|------|--------|
| GET | /admin/routing-v2/providers | Lista providers |
| POST | /admin/routing-v2/providers/bootstrap-core | Cria 3 provedores |
| GET | /admin/routing-v2/providers/{id}/health | Health de um provider |
| GET | /admin/routing-v2/models | Lista modelos |
| POST | /admin/routing-v2/models/bootstrap-canonical | Cria 7 modelos |
| GET | /admin/routing-v2/routes | Lista routes |
| POST | /admin/routing-v2/routes/bootstrap-canonical | Cria 15 routes |
| POST | /admin/routing-v2/pricing/sync | Sincroniza preços |
| GET | /admin/routing-v2/smart-router/readiness | Status de readiness |
| POST | /admin/routing-v2/smart-router/select | Seleciona route |
| GET | /admin/routing-v2/health | Saúde geral do sistema |

---

## ✅ Estado Atual

**Production**: DEPLOYED ✅
**Mode**: HYBRID (V2 ativo com V1 fallback)
**Health**: Todos 3 provedores ACTIVE
**Models**: 7 canônicos ACTIVE
**Routes**: 15 criadas, em transição para READY (após pricing sync)
**Smart Router**: Operacional, selecionando READY routes
**Wallet/Jobs/Assets**: Preservados, funcionais

---

## 🎯 Próximos Passos

1. **Teste de Geração**:
   ```bash
   POST /api/generate
   {
     "model_id": "model-flux-1-pro",
     "mode": "text-to-image",
     "prompt": "test"
   }
   ```
   Smart Router seleciona provider automaticamente

2. **Monitor de Health**:
   - Checks automáticos a cada 30 min
   - Dashboard admin mostra status real-time

3. **Transição para V2_ONLY**:
   - Atualmente em HYBRID
   - V1 fallback disponível
   - Quando tudo estiver maduro → V2_ONLY

