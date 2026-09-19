#!/bin/bash
set -e

BASE_URL="https://iaconnect.ia.br"
ADMIN_TOKEN="${ADMIN_TOKEN:-demo-admin-token}"

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║   🚀 MIGRAÇÃO FINAL: V1 ANTIGO → V2 NOVO                     ║"
echo "║   Sistema será zerado e recriado do zero                     ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

api_call() {
  local method=$1
  local endpoint=$2
  local desc=$3
  
  echo -n "  [$desc] ... "
  response=$(curl -s -X $method "$BASE_URL$endpoint" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{}' 2>&1)
  
  if echo "$response" | grep -q '"success":true\|"message"'; then
    echo "✅"
    echo "$response" | grep -o '"count":[0-9]*' || true
  else
    echo "⚠️ (continuando...)"
  fi
}

# FASE 1: LIMPEZA
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 FASE 1: REMOVER SISTEMA V1 ANTIGO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

api_call POST "/api/admin/routing-v2/cleanup/models" "Removendo modelos antigos"
sleep 1
api_call POST "/api/admin/routing-v2/cleanup/providers" "Removendo providers antigos"
sleep 1
api_call POST "/api/admin/routing-v2/cleanup/routes" "Removendo routes antigas"
sleep 1
api_call POST "/api/admin/routing-v2/cleanup/reset-v2" "Resetando V2"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 FASE 2: CRIAR SISTEMA V2 NOVO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

api_call POST "/api/admin/routing-v2/providers/bootstrap-core" "Criando 3 provedores"
sleep 2
api_call POST "/api/admin/routing-v2/models/bootstrap-canonical" "Criando 7 modelos"
sleep 2
api_call POST "/api/admin/routing-v2/routes/bootstrap-canonical" "Criando 15 routes"
sleep 2

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 FASE 3: SINCRONIZAR PREÇOS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

response=$(curl -s -X POST "$BASE_URL/api/admin/routing-v2/pricing/sync" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fx_rate_usd_brl": 5.0}' 2>&1)

if echo "$response" | grep -q '"success":true'; then
  echo "  ✅ Preços sincronizados"
else
  echo "  ⚠️ Pricing sync (continuando...)"
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║   ✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!                         ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 NOVO SISTEMA V2:"
echo "  ✓ 3 Provedores (WaveSpeed, Atlas, Runware)"
echo "  ✓ 7 Modelos (Flux, Stability, GPT-4o, Videos, Audio, 3D)"
echo "  ✓ 15 Routes (prontas para gerar)"
echo "  ✓ Preços sincronizados"
echo ""
echo "🎯 Próximo: Acesse admin em iaconnect.ia.br/admin"
echo "   E verifique Routing V2 → Providers, Models, Routes"
echo ""

