# Design: cartões guiados para sessões e local

## Intenção

Tornar o preenchimento de sessões compreensível para quem organiza um evento pela primeira vez, sem expor IDs técnicos nem exigir que a pessoa entenda herança de configuração. A etapa deve continuar salvando automaticamente e mostrar com clareza o que está completo e o que ainda impede a publicação.

## Objetivos

- Apresentar cada sessão em um cartão com seções nomeadas: horário, capacidade, vendas, local e mapa.
- Substituir entradas de local e mapa por seleções visuais baseadas nas opções disponíveis no evento.
- Usar o local e o mapa padrão como escolha inicial, com uma ação explícita para configurar uma exceção.
- Manter campos avançados ocultos até que a exceção seja ativada.
- Mostrar estado por sessão: pronta, incompleta ou com erro, incluindo a próxima ação necessária.
- Preservar autosave, recuperação de sessão salva e validação de prontidão existente.

## Fora do escopo

- Alterar o modelo de dados ou as regras de publicação.
- Criar cadastro de locais ou mapas dentro desta etapa.
- Mudar a regra de capacidade vendável ou o fluxo de inventário.
- Reorganizar as demais etapas do workspace.

## Experiência proposta

O topo da etapa terá título, explicação curta e botão primário “Adicionar sessão”. Cada sessão será exibida como “Sessão 1”, “Sessão 2” etc., com um indicador de estado no cabeçalho.

O cartão será dividido em quatro blocos:

1. **Quando acontece**: início e término da sessão, com rótulos visíveis e formato local legível.
2. **Capacidade e vendas**: capacidade vendável, início das vendas e encerramento das vendas, com texto de apoio explicando que a capacidade precisa ser compatível com o inventário.
3. **Local**: seleção visual “Usar local padrão” ou “Escolher outro local”. Ao escolher outro, aparece um seletor com o nome do local; o ID fica apenas no payload.
4. **Mapa de assentos**: seleção visual “Usar mapa padrão” ou “Escolher outro mapa”. Ao escolher outro, aparece um seletor com nome/status do mapa; o ID fica apenas no payload.

Ações secundárias ficam no rodapé do cartão, incluindo remover sessão. O cartão exibe uma mensagem contextual quando faltar algum dado, por exemplo: “Informe o horário de término” ou “Escolha um local para esta sessão”. Enquanto houver erro, o autosave não envia uma sessão incompleta ao servidor; a informação permanece local para ser corrigida.

## Dados e integração

A tela continuará consumindo as sessões da API e deverá carregar também as opções de locais e mapas já cadastrados para o evento. A serialização continua convertendo as opções visuais para `locationId` e `mapId`, usando `null` quando a sessão herda o padrão. O autosave preservará os IDs retornados para sessões novas e atualizará o readiness depois de cada salvamento bem-sucedido.

## Acessibilidade e feedback

Todos os controles terão rótulo associado, ajuda curta quando necessário, estados de erro ligados ao campo e foco visível. O indicador de estado será texto, não apenas cor. A mensagem de salvamento continuará no topo da etapa e diferenciará “salvando”, “salvo” e “conflito”.

## Validação de sucesso

- Uma pessoa consegue criar uma sessão sem conhecer IDs.
- O cartão deixa evidente o próximo campo que falta.
- Herança de local e mapa é a opção inicial e pode ser desativada sem perder o restante do formulário.
- Uma sessão salva reaparece com o nome do local/mapa, não com UUIDs.
- O checklist do workspace reflete o salvamento sem exigir recarregamento manual.
- Os testes cobrem renderização dos rótulos, seleção de exceção, sessão incompleta e persistência dos IDs.

## Abordagens consideradas

- **Cartões guiados por sessão (escolhida)**: melhor equilíbrio entre orientação, densidade e compatibilidade com o fluxo atual.
- **Fluxo em etapas**: mais simples por tela, mas aumenta cliques e dificulta comparar várias sessões.
- **Tabela operacional**: rápida para muitos horários, mas inadequada para o primeiro preenchimento e para herança de local/mapa.

## Decisões do implementador

- Os nomes de locais e mapas virão da API existente; se não houver opções, a interface explicará qual etapa precisa ser concluída antes.
- A remoção de sessão pedirá confirmação apenas quando a sessão já tiver sido persistida; uma sessão ainda local será removida imediatamente.
- A indicação de capacidade usará o texto “capacidade vendável” para alinhar a interface à regra de inventário do Portal CEF.
