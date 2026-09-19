#!/bin/bash

echo "🧹 Iniciando limpeza completa do banco de dados..."
echo ""

# Variáveis
ADMIN_TOKEN="$1"
BASE_URL="https://iaconnect.ia.br"

if [ -z "$ADMIN_TOKEN" ]; then
  echo "❌ Token admin não fornecido"
  echo "Uso: ./cleanup_via_api.sh YOUR_ADMIN_TOKEN"
  exit 1
fi

# Função para fazer requisição
call_api() {
  local method=$1
  local endpoint=$2
  local data=$3
  
  if [ -z "$data" ]; then
    curl -s -X $method "$BASE_URL$endpoint" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json"
  else
    curl -s -X $method "$BASE_URL$endpoint" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data"
  fi
}

echo "1️⃣ Limpando modelos antigos..."
call_api POST "/api/admin/routing-v2/cleanup/models"

echo ""
echo "2️⃣ Limpando providers antigos..."
call_api POST "/api/admin/routing-v2/cleanup/providers"

echo ""
echo "3️⃣ Limpando routes antigas..."
call_api POST "/api/admin/routing-v2/cleanup/routes"

echo ""
echo "✨ Limpeza concluída!"
echo ""
echo "Próximo passo: Execute os 4 endpoints de bootstrap V2"

