# IA Connect — configuração e validação de providers

## Providers oficiais

O Routing V2 usa somente WaveSpeed AI, Atlas Cloud e Runware. O cadastro-base e a descoberta remota consultam apenas esses três provedores. Providers antigos que ainda apareçam no inventário ficam fora do bootstrap, das buscas e das checagens de saúde; eles não são removidos automaticamente do banco.

O botão **Cadastrar os 3 oficiais** atualiza o cadastro desses três e preserva o status já salvo. Ele não reativa providers desativados, não valida credenciais, não importa modelos, não confirma preços e não cria rotas.

O status `ACTIVE` indica que o provider está habilitado no inventário. `UNKNOWN` significa que ainda não há uma checagem de saúde válida. Nenhum desses estados, sozinho, significa que uma geração possa ser executada.

## Chaves do Worker

As chaves devem ser configuradas como secrets do Worker `ia-conect`, nunca no frontend ou no Git:

```text
WAVESPEED_API_KEY
ATLAS_API_KEY
RUNWARE_API_KEY
```

A existência do nome de um secret não confirma que seu valor esteja correto, ativo ou autorizado para o produto solicitado. Não copie valores de secrets para logs, tickets ou capturas de tela.

## Descoberta e validação de catálogo

Em **Administração → IA & Roteamento → Modelos**, a descoberta remota consulta somente WaveSpeed AI, Atlas Cloud e Runware. É uma busca de leitura: os resultados não são gravados no inventário do IA Connect e não criam modelos ou rotas.

Os resultados do mesmo modelo de vídeo são agrupados por identidade e variante, removendo diferenças de operação e resolução dos identificadores. Variantes reais como Fast, Mini, Lite e Pro continuam separadas. Cada resultado mostra os bindings distintos dos provedores oficiais que oferecem o modelo.

Nos indicadores por provider, **encontrado(s) na API** é a quantidade de itens brutos retornados para a busca; **reconhecido(s)** é a quantidade de modelos lógicos únicos que passaram pelo agrupamento e reconhecimento do catálogo. Esses contadores não representam o total de modelos persistidos nem modelos prontos para geração.

O antigo painel e fluxo **APIs & Scan** não está conectado à tela administrativa ativa. Não use instruções antigas que indiquem esse painel como fonte de saúde ou catálogo atual.

## Quando uma geração está pronta

Uma geração pela rota V2 precisa de todos estes itens verificados:

1. Secret válido para o provider.
2. Model identifier confirmado no provider.
3. Capability compatível com aquele identifier.
4. Preço e unidade de cobrança verificados para a configuração usada.
5. Modelo e rota cadastrados no inventário.
6. Rota `READY`, com preço vigente e estado de runtime saudável.

Somente rotas `READY` são elegíveis para publicação aos geradores. Uma geração de ponta a ponta pode consumir saldo do provider; por isso, os probes de saúde fazem apenas chamadas de leitura. O teste real de geração deve ser feito depois de escolher modelo, entrada e custo estimado.

## Estado das verificações

- `ACTIVE`: cadastro habilitado.
- `UNKNOWN`: saúde ainda não verificada.
- `HEALTHY`: o probe de leitura do provider passou; isso não valida todo modelo ou capability.
- Catálogo descoberto: resultado remoto de pesquisa, ainda não persistido.
- Rota `READY`: passou pelas verificações atuais de mapping, preço e runtime.

Registre qualquer falha com provider, operação, horário e código de erro, sem incluir API keys ou dados privados do usuário.
