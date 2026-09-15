# IA Connect — Performance baseline

Baseline source: `main@98ddc09b871d93e96ab722ff72a707a45e674700`  
Roadmap stage: Etapa 1 — medição e observabilidade.

## Objetivo

Criar uma linha de base reproduzível antes de qualquer mudança arquitetural de cache, upload, concorrência ou code splitting.

Metas do roadmap:

- LCP p75 <= 2,5 s.
- INP p75 <= 200 ms.
- CLS <= 0,1.
- Navegação já aquecida/cacheada percebida em aproximadamente 300–500 ms ou menos.
- Redução mensurável de requests, payload e latência das APIs críticas.

## Instrumentação adicionada

### Browser

`src/utils/performanceMetrics.ts` coleta, sem enviar dados para terceiros:

- FCP.
- último candidato de LCP da sessão.
- CLS por janela de sessão.
- candidato de INP da sessão (maior interação observada; não substitui p75 de campo).
- Navigation Timing: TTFB, DOMContentLoaded e load.
- quantidade e bytes de Resource Timing.
- 10 maiores recursos visíveis ao navegador.
- tempo entre clique de navegação e render da view.
- duração, status, tamanho aproximado da resposta e `Server-Timing` de chamadas feitas por `apiRequest`.

Snapshot manual no DevTools:

```js
window.__IA_PERF__?.snapshot()
```

Limpeza da amostra atual:

```js
window.__IA_PERF__?.clear()
```

Nenhum prompt, token, corpo de request, e-mail ou outro dado do usuário é armazenado pela instrumentação.

### API

O router raiz adiciona `Server-Timing: app;dur=<ms>` às respostas da API para separar tempo observado pelo cliente do tempo gasto na aplicação do backend.

### Bundle

Depois de `npm run build`:

```bash
npm run perf:bundle
```

gera `performance-baseline.json` com:

- quantidade de chunks JS/CSS;
- bytes raw e gzip;
- tamanho total de `dist`;
- maiores arquivos do build.

O CI publica esse JSON como artifact por 14 dias e adiciona o resumo ao job.

## Pontos críticos que precisam constar no "antes"

| Fluxo | Endpoint / métrica |
| --- | --- |
| Home autenticada | primeira carga + `GET /api/generations?limit=100` |
| Comunidade | `GET /api/community/feed` |
| Biblioteca | `GET /api/assets` + entidades/projetos conforme a aba |
| Gerador de imagem | `GET /api/catalog/models`, `GET /api/assets`, `GET /api/user/preferences`, quotes |
| Gerador de vídeo | modelos, assets, preferências e quotes equivalentes |
| Preço | `POST /api/generations/quote` |
| Navegação | `views[].duration_ms` no snapshot |
| Bundle | artifact `performance-baseline-<sha>` do CI |

## Baseline estrutural observado antes das otimizações

- `App.tsx` importa as views principais estaticamente; ainda não existe code splitting das áreas pesadas.
- O gerador de imagem monta carregando modelos, assets e preferências em paralelo.
- O cálculo de preço do gerador de imagem ainda pode abrir múltiplos quotes em paralelo por modelo compatível.
- Upload de múltiplas imagens ainda é sequencial no fluxo atual.
- A mídia dinâmica ainda pode usar original onde thumbnail própria não existe.
- O feed da Comunidade já usa `batchGet`; o N+1 corrigido não deve ser reintroduzido.

Esses itens são diagnóstico de baseline. Eles não são alterados nesta etapa.

## Protocolo para números de runtime

Para comparação consistente:

1. Desktop: executar ao menos 5 amostras por tela em cold load e 5 em navegação aquecida.
2. Mobile/rede limitada: repetir com Fast 4G e CPU throttling 4x; na QA final incluir Fast 3G.
3. Capturar Home, Comunidade, Biblioteca, Gerar imagem e Gerar vídeo.
4. Após cada rodada, copiar `window.__IA_PERF__.snapshot()`.
5. Para p75 real de produto, agregar amostras de campo; o candidato de INP de uma única sessão não deve ser rotulado como p75.

## Tabela "antes"

| Área | LCP | INP | CLS | Navegação aquecida | Requests / bytes | Status |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Landing pública | — | — | — | n/a | — | captura sintética pendente |
| Home autenticada | — | — | — | — | — | requer sessão autenticada |
| Comunidade | — | — | — | — | — | requer sessão autenticada |
| Biblioteca | — | — | — | — | — | requer sessão autenticada |
| Gerar imagem | — | — | — | — | — | requer sessão autenticada |
| Gerar vídeo | — | — | — | — | — | requer sessão autenticada |
| Bundle inicial | CI | n/a | n/a | n/a | `performance-baseline.json` | automatizado |

A tabela só deve receber números efetivamente medidos. Não preencher valores estimados.
