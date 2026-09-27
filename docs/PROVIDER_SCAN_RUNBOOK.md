# IA Connect — configuração e validação de providers

## Providers cadastrados

O cadastro-base do Routing V2 inclui nove providers: WaveSpeed AI, Atlas Cloud, Runware, fal.ai, DeepInfra, Replicate, AI/ML API, PiAPI e Kie.ai. O botão **Cadastrar 9 providers** é idempotente e registra metadados e adapters; não valida credenciais, não importa modelos, não confirma preços e não cria rotas.

O status `ACTIVE` indica que o provider está habilitado no inventário. `UNKNOWN` significa que ainda não há uma checagem de saúde válida. Nenhum desses estados, sozinho, significa que uma geração possa ser executada.

## Chaves do Worker

As chaves devem ser configuradas como secrets do Worker `ia-conect`, nunca no frontend ou no Git:

```text
WAVESPEED_API_KEY
ATLAS_API_KEY
RUNWARE_API_KEY
FAL_API_KEY
DEEPINFRA_API_KEY
REPLICATE_API_TOKEN
AIML_API_KEY
PIAPI_API_KEY
KIE_API_KEY
```

A existência do nome de um secret não confirma que seu valor está correto, ativo ou autorizado para o produto solicitado. Não copie valores de secrets para logs, tickets ou capturas de tela.

## Descoberta e validação de catálogo

Em **Administração → IA & Roteamento → Modelos**, a descoberta unificada consulta os catálogos remotos de WaveSpeed, Atlas Cloud, Runware, fal.ai, DeepInfra, Replicate e AI/ML API. É uma busca de leitura: os resultados não são gravados no inventário do IA Connect e não criam modelos ou rotas. fal.ai, Replicate e AI/ML API usam consultas de catálogo oficiais; DeepInfra expõe uma lista pública e a filtragem é feita no Worker.

PiAPI e Kie.ai continuam cadastrados, mas não aparecem nessa busca. A documentação pública consultada da PiAPI descreve criação e consulta de tarefas, sem um endpoint de catálogo ou probe de conta que possamos usar com segurança. Kie.ai tem um endpoint oficial de saldo, usado apenas para a checagem de saúde; a lista de modelos continua sendo o Market documentado, sem endpoint de catálogo por API confirmado. Não invente identifiers nem converta um resultado de busca em rota automaticamente.

Os probes específicos de saúde consultam endpoints oficiais de leitura para fal.ai, DeepInfra, Replicate, AI/ML API e Kie.ai, além dos três checks existentes de WaveSpeed, Atlas Cloud e Runware. O probe valida apenas credencial e disponibilidade do endpoint consultado; não confirma cada modelo, capability, preço ou geração. PiAPI permanece `UNKNOWN` enquanto não houver um probe autenticado seguro documentado.

O antigo painel e fluxo **APIs & Scan** não está conectado à tela administrativa ativa. Não use instruções antigas que indiquem esse painel como fonte de saúde ou catálogo atual.

## Quando uma geração está pronta

Uma geração pela rota V2 precisa de todos estes itens verificados:

1. Secret válido para o provider.
2. Model identifier confirmado no provider.
3. Capability compatível com aquele identifier.
4. Preço e unidade de cobrança verificados para a configuração usada.
5. Modelo e rota cadastrados no inventário.
6. Rota `READY`, com preço vigente e estado de runtime saudável.

Somente rotas `READY` são elegíveis para publicação aos geradores. Uma geração de ponta a ponta pode consumir saldo do provider; por isso, os testes automáticos e os probes de saúde ficam em chamadas de leitura. O teste real de geração deve ser feito depois de escolher modelo, entrada e custo estimado.

## Estado das verificações

- `ACTIVE`: cadastro habilitado.
- `UNKNOWN`: saúde ainda não verificada.
- `HEALTHY`: o probe implementado para aquele provider passou; isso não valida todo modelo/capability.
- Catálogo descoberto: resultado remoto de pesquisa, ainda não persistido.
- Rota `READY`: passou pelas verificações atuais de mapping, preço e runtime.

Registre qualquer falha com provider, operação, horário e código de erro, sem incluir API keys ou dados privados do usuário.
