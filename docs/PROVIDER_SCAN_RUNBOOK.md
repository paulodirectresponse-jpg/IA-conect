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

Em **Administração → IA & Roteamento → Modelos**, a descoberta unificada consulta atualmente WaveSpeed, Atlas Cloud e Runware. É uma busca remota de leitura: os resultados não são gravados no inventário do IA Connect e não criam modelos ou rotas.

Os seis outros providers estão cadastrados com adapters de compatibilidade para execução, mas ainda não participam dessa descoberta unificada nem têm checagem de saúde V2 específica. Para eles, o model identifier, a capability, o formato de entrada e o preço precisam ser confirmados na documentação ou catálogo oficial do provider antes de criar uma rota. Não invente identifiers nem converta um resultado de busca em rota automaticamente.

O antigo painel e fluxo **APIs & Scan** não está conectado à tela administrativa ativa. Não use instruções antigas que indiquem esse painel como fonte de saúde ou catálogo atual.

## Quando uma geração está pronta

Uma geração pela rota V2 precisa de todos estes itens verificados:

1. Secret válido para o provider.
2. Model identifier confirmado no provider.
3. Capability compatível com aquele identifier.
4. Preço e unidade de cobrança verificados.
5. Modelo e rota cadastrados no inventário.
6. Rota `READY`, com preço vigente e estado de runtime saudável.

Somente rotas `READY` são elegíveis para publicação aos geradores. Para os seis providers sem probe V2, ainda é necessário implementar ou executar uma checagem oficial sem gerar mídia antes de liberá-los. Uma geração de ponta a ponta pode consumir saldo do provider e só deve ser feita com um modelo, entrada e custo estimado definidos.

## Estado das verificações

- `ACTIVE`: cadastro habilitado.
- `UNKNOWN`: saúde ainda não verificada.
- `HEALTHY`: o probe implementado para aquele provider passou; isso não valida todo modelo/capability.
- Catálogo descoberto: resultado remoto de pesquisa, ainda não persistido.
- Rota `READY`: passou pelas verificações atuais de mapping, preço e runtime.

Registre qualquer falha com provider, operação, horário e código de erro, sem incluir API keys ou dados privados do usuário.
