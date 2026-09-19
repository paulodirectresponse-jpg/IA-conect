# 🎯 Prompt para Verificar Migração V1→V2 no ChatGPT

Copie e cole o prompt abaixo no ChatGPT para verificar se a migração foi bem-sucedida:

---

## PROMPT COMPLETO:

```
# Verificação de Migração: Sistema V1 Antigo → V2 Novo
## Contexto: IA Conect - Plataforma de Geração de Conteúdo com IA

### 📋 SITUAÇÃO ANTERIOR (V1 - ANTIGO - DEVE ESTAR DELETADO):
- **5+ Modelos desorganizados**: Flux 2 Pro, Google Nano Banana 2 Lite, Google Nano Banana Pro, GPT Image 2, Seedream 5.0 Pro, WAN 3.0, Google Omni Flash, Grok Imagine Video, Kling 3.0, ElevenLabs Multilingual v2, ElevenLabs Turbo v2.5, Immersid Realtime TTS 2.0, MiniMax Speech 2.4/2.8, e mais
- **5+ Providers desorganizados**: Replicate, FAL, DeepInfra, Mercado Pago, AIML API, PiAPI, KIE.AI, e mais
- **Routing confuso**: Sem lógica clara de seleção
- **Preços**: Sem sincronização real
- **Admin**: Misturando V1 + V2 (uma bagunça)

### 🎯 SITUAÇÃO NOVA (V2 - NOVO - DEVE ESTAR CRIADO):

#### 1️⃣ PROVEDORES (Exatamente 3):
```
✅ provider-wavespeed:
   - Nome: WaveSpeed
   - Status: ACTIVE
   - Prioridade: 1 (maior)
   - Adapter: wavespeed-v3
   - API: https://api.wavespeed.ai

✅ provider-atlas:
   - Nome: Atlas Cloud
   - Status: ACTIVE
   - Prioridade: 2
   - Adapter: atlas-cloud-v1
   - API: https://api.atlascloud.ai

✅ provider-runware:
   - Nome: Runware
   - Status: ACTIVE
   - Prioridade: 3
   - Adapter: runware-v1
   - API: https://api.runware.ai/v1
```

#### 2️⃣ MODELOS (Exatamente 7):
```
✅ model-flux-1-pro
   - Nome: Flux 1 Pro
   - Categoria: IMAGE
   - Vendor: Black Forest Labs
   - Status: ACTIVE

✅ model-stability-3.5-large
   - Nome: Stability 3.5 Large
   - Categoria: IMAGE
   - Vendor: Stability AI
   - Status: ACTIVE

✅ model-openai-gpt-4o
   - Nome: GPT-4o
   - Categoria: OTHER
   - Vendor: OpenAI
   - Status: ACTIVE

✅ model-falconsai-video-2
   - Nome: FalconSAI Video 2
   - Categoria: VIDEO
   - Vendor: FalconSAI
   - Status: ACTIVE

✅ model-atlas-video-gen
   - Nome: Atlas Video Gen
   - Categoria: VIDEO
   - Vendor: Atlas Cloud
   - Status: ACTIVE

✅ model-runware-audio-turbo
   - Nome: Runware Audio Turbo
   - Categoria: AUDIO
   - Vendor: Runware
   - Status: ACTIVE

✅ model-runware-3d-gen
   - Nome: Runware 3D Gen
   - Categoria: MODEL_3D
   - Vendor: Runware
   - Status: ACTIVE
```

#### 3️⃣ ROUTES (Exatamente 15):
```
1. Flux 1 Pro + WaveSpeed text-to-image
2. Flux 1 Pro + Runware text-to-image
3. Stability 3.5 + WaveSpeed text-to-image
4. Stability 3.5 + Atlas text-to-image
5. GPT-4o + WaveSpeed text-to-speech
6. FalconSAI Video 2 + WaveSpeed text-to-video
7. FalconSAI Video 2 + Runware text-to-video
8. Atlas Video Gen + Atlas text-to-video
9. Runware Audio + Runware text-to-speech
10. Runware 3D + Runware text-to-3d
(+ 5 mais routes mapeando cada modelo em 1-2 provedores)
```

### 🔄 DECISÕES E ARQUITETURA:

#### Por que 3 provedores?
- **WaveSpeed**: Premium, rápido, suporta múltiplos modelos (IMAGE, AUDIO, VIDEO)
- **Atlas**: Alternativa confiável para IMAGE e VIDEO
- **Runware**: Especializado em AUDIO e 3D

#### Por que 7 modelos?
- **IMAGE**: 2 (Flux = speed, Stability = quality)
- **VIDEO**: 2 (FalconSAI = geral, Atlas = premium)
- **AUDIO**: 1 (Runware = best quality)
- **3D**: 1 (Runware = único com 3D)
- **OTHER**: 1 (GPT-4o = fallback text)

#### Por que 15 routes (não 7)?
- Cada modelo tem 1-2 provedores alternativos
- Smart Router seleciona o melhor disponível
- Redunda: se WaveSpeed cai, Runware/Atlas continuam

#### Smart Router - Lógica de Seleção:
1. Filtra routes com status READY (não DISCOVERED/PRICED)
2. Ordena por: HEALTHY > DEGRADED
3. Depois por: preço mais barato
4. Depois por: provider alfabético (determinismo)

#### Economia:
- Base: 1000 créditos = R$9
- Provider custa $0.05 → ~49 créditos (com margins/FX)
- FX rate: USD→BRL = 5.0
- Target margin: 40%
- Safety buffer: 5%

### ❓ CHECKLIST DE VERIFICAÇÃO:

Responda se cada item está correto:

**No site (https://iaconnect.ia.br):**
- [ ] Gerar Imagem: Mostra modelos V2 (Flux 1 Pro, Stability 3.5) - NÃO mostra Flux 2, Google Nano, etc
- [ ] Gerar Vídeo: Mostra modelos V2 (FalconSAI Video 2, Atlas Video Gen) - NÃO mostra WAN 3.0, Kling 3.0, etc
- [ ] Gerar Áudio: Mostra modelos V2 (Runware Audio) - NÃO mostra ElevenLabs, MiniMax, etc
- [ ] Gerar 3D: Mostra Runware 3D Gen

**Na Admin (https://iaconnect.ia.br/admin → Routing V2):**
- [ ] Aba Providers: Mostra 3 provedores (WaveSpeed, Atlas, Runware) - EXATAMENTE 3
- [ ] Aba Models: Mostra 7 modelos - EXATAMENTE 7
- [ ] Aba Routes: Mostra 15 routes - EXATAMENTE 15
- [ ] Aba Health: Sistema OPERATIONAL, provedores HEALTHY
- [ ] Visão Geral: Mostra apenas dados V2 (não mistura V1)

**Funcionalidade:**
- [ ] Ao gerar uma imagem, Smart Router seleciona provedor automaticamente
- [ ] Preço aparece ANTES de gerar (em créditos)
- [ ] Geração completa sem erros
- [ ] Asset salvo na biblioteca

### 🚨 Se algo estiver ERRADO:

**Cenário 1**: Ainda mostra modelos antigos (Flux 2, Google Nano, etc)
→ **Ação**: Cache do navegador. Limpe com Ctrl+Shift+Delete ou abra em Incognito

**Cenário 2**: Admin mostra Providers/Models/Routes vazios
→ **Ação**: Dados não entraram no banco. Precisa fazer bootstrap manualmente

**Cenário 3**: Gerar imagem não funciona
→ **Ação**: Smart Router sem routes READY. Precisa sincronizar preços

**Cenário 4**: Admin mistura V1 + V2
→ **Ação**: Frontend não foi recarregado. F5 forçado (Ctrl+F5)

### ✅ Se TUDO estiver certo:
- V1 antigo completamente removido ✅
- V2 novo 100% operacional ✅
- Admin organizado e limpo ✅
- Sistema pronto para produção ✅

---

**Verifique cada item acima e me diga:**
1. Quantos itens estão ✅ (corretos)
2. Quantos itens estão ❌ (errados)
3. Se houver ❌, qual é o cenário?
```

---

## 📝 INSTRUÇÕES:

1. **Copie o prompt acima (tudo entre as linhas ```)**
2. **Abra ChatGPT**: https://chatgpt.com
3. **Cole o prompt completo**
4. **ChatGPT vai:**
   - Entender o contexto da migração
   - Saber exatamente o que verificar
   - Dar instruções se algo estiver errado
   - Explicar as decisões arquiteturais

---

## 💡 Por que este prompt é bom:

✅ **Contexto completo**: Explica V1 vs V2  
✅ **Decisões claras**: Por que 3 providers, 7 modelos, 15 routes  
✅ **Checklist prático**: 14 itens para verificar  
✅ **Troubleshooting**: Se der erro, já tem solução  
✅ **Cenários reais**: Mostra o que pode dar errado e como corrigir  

---

## 🎯 O que ChatGPT vai fazer:

1. Entender que você fez uma migração
2. Verificar cada item que você disser ✅ ou ❌
3. Ajudar a diagnosticar problemas
4. Explicar por que decidiu assim (pedagogia)
5. Sugerir próximos passos

---

**Pronto para enviar ao ChatGPT!** 🚀
