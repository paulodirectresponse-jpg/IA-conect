# IA Conect — Runbook de ativação e scan dos providers

## Objetivo

Este documento descreve o ponto de ativação da fundação multi-provider do IA Conect.

O código pode ser publicado sem as novas chaves. Sem o secret correspondente, o adapter permanece não configurado e não participa de execução real.

## Secrets esperados

Cadastre no Worker `ia-conect` como **Secret**, nunca como valor público no frontend:

```text
ATLAS_API_KEY =
WAVESPEED_API_KEY =
RUNWARE_API_KEY =
FAL_API_KEY =
DEEPINFRA_API_KEY =
REPLICATE_API_TOKEN =
AIML_API_KEY =
PIAPI_API_KEY =
KIE_API_KEY =
```

Os sete últimos correspondem aos novos providers integrados nesta etapa.

## Onde conferir no produto

Após as chaves estarem disponíveis no runtime:

1. Entrar como administrador.
2. Abrir **Administração**.
3. Abrir a aba **APIs & Scan**.
4. Conferir a coluna **Secret**.
5. Cada provider configurado deve aparecer como **Detectada**.
6. Clicar em **Escanear todos**.

Nenhum valor de API key é enviado ao navegador. O frontend recebe somente o booleano `is_configured`.

## O que o scan faz

O scan percorre os providers registrados e produz um inventário de candidatos.

Modos atuais:

- `CATALOG_API`: catálogo consultado diretamente por API.
- `SEARCH_API`: catálogo obtido por buscas controladas no provider.
- `CURATED_REQUIRED`: provider sem listagem pública estável suficiente; usa mappings explicitamente validados e não inventa IDs.

Depois da descoberta, o sistema:

1. normaliza nome e ID do provider;
2. compara com o acervo canônico do IA Conect;
3. separa capability por função;
4. gera propostas de mapping com confiança;
5. marca mappings já existentes;
6. salva o último scan para auditoria no Admin.

## Acervo alvo

O catálogo curado tem 86 posições por função:

- 12 — geração de imagem
- 10 — edição de imagem
- 12 — geração de vídeo
- 10 — edição de vídeo
- 10 — extensão de vídeo
- 10 — voz
- 8 — música
- 6 — efeitos sonoros
- 8 — 3D

O scan não publica automaticamente qualquer modelo encontrado fora deste catálogo.

## Travas de segurança

Encontrar um nome parecido não é suficiente para liberar execução.

Fluxo obrigatório:

```text
Provider configurado
      ↓
Scan
      ↓
Modelo canônico identificado
      ↓
Capability confirmada
      ↓
Preço verificado
      ↓
Mapping aprovado
      ↓
Elegível ao Smart Router
```

Um mapping novo não pode ser aprovado se não existir preço verificado para `provider + provider_model_identifier + capability`.

Os modelos novos do acervo entram como `EXPERIMENTAL` e `beta_only`. Eles não são promovidos automaticamente para a experiência Stable.

## Depois do primeiro scan real

Revisar no Admin:

- providers sem chave;
- erros de autenticação;
- candidatos encontrados;
- correspondências modelo × provider;
- IDs específicos do provider;
- capabilities;
- pricing pendente;
- mappings já ativos.

Somente após essa revisão devem ser validados preços e aprovados novos mappings.

## Não fazer

- não inserir secrets no GitHub;
- não colocar API keys em `.env.example` com valores reais;
- não expor keys no React;
- não ativar mapping apenas por igualdade aproximada de nome;
- não liberar provider no Smart Router sem COGS verificado;
- não promover modelos experimentais para Stable automaticamente.
