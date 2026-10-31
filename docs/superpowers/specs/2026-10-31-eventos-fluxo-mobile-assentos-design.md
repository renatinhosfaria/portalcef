# Fluxo mobile de compra e seleção de assentos — Design

## Intenção

Melhorar o caminho de compra da vitrine pública de eventos para que uma pessoa consiga sair da página do evento, escolher ingressos e chegar ao checkout com clareza em telas pequenas. O trabalho responde aos problemas observados no navegador: o CTA mobile perde o contexto do evento, o mapa de assentos fica ilegível no celular e o resumo da seleção aparece depois de uma lista longa.

## Objetivos

- Manter o usuário na página do evento ao acionar o CTA mobile, levando-o à seção de sessões.
- Preservar a planta visual de assentos no desktop.
- Oferecer no mobile uma seleção legível por fileira, com acesso opcional ao mapa.
- Exibir quantidade, assentos, tipos de ingresso e total em um resumo fixo durante a seleção.
- Deixar o checkout acionável assim que a seleção estiver completa, sem alterar a API de reserva nem o formato dos parâmetros atuais.
- Corrigir a tela intermediária de escolha de ingresso para manter cards e contexto quando acessada diretamente.

## Fora do escopo

- Alterar backend, disponibilidade, reserva, pagamento, regras de elegibilidade ou painel administrativo.
- Redesenhar a geometria dos mapas cadastrados.
- Criar zoom livre ou editor de mapas nesta etapa.
- Alterar o contrato de checkout (`assentos`, `ticketTypeIds` e `sessionId`).

## Abordagens consideradas

1. **Híbrida responsiva — escolhida.** O desktop continua usando a planta proporcional. O mobile começa em uma lista agrupada por fileira, com seletor de fileira e um controle para abrir o mapa quando a pessoa precisar de referência espacial. O resumo compacto fica fixo no rodapé; o resumo detalhado permanece disponível no conteúdo.
2. **Mapa com zoom em todos os dispositivos.** Preserva a planta em qualquer tela, mas introduz gestos, controles e estados de navegação que aumentam a complexidade e ainda deixam a seleção por texto menos acessível.
3. **Lista como visão principal em todas as telas.** Simplifica acessibilidade e performance, mas remove a referência espacial que é útil para escolher lugares no teatro.

A abordagem híbrida foi escolhida porque mantém a referência espacial existente sem obrigar o usuário mobile a interagir com centenas de botões sobrepostos.

## Decisões de interação

- O CTA fixo mobile da página do evento aponta para `#sessoes`, como o CTA desktop, em vez de abrir diretamente a rota sem `ticketTypeId`.
- A tela sem `ticketTypeId` continua válida para links diretos, mas apresenta os tipos de ingresso como cards responsivos com preço, elegibilidade e ação clara.
- No mobile, a seleção começa na aba/lista de assentos. A fileira inicial é a primeira fileira que contém assentos disponíveis; o usuário pode trocar a fileira por um seletor.
- O mapa mobile fica acessível por um controle `Mapa` e mantém rolagem horizontal dentro de um contêiner, sem competir com a lista na primeira visualização.
- A lista mostra apenas a fileira selecionada, reduzindo o volume visual e a árvore de acessibilidade. Assentos indisponíveis continuam visíveis com estado e não podem ser selecionados.
- O resumo fixo mostra quantidade selecionada, total calculado pelos tipos escolhidos e o botão `Continuar para checkout`. O botão permanece desabilitado quando não há assentos ou quando algum assento ainda não tem tipo de ingresso.
- O resumo detalhado continua permitindo trocar o tipo de ingresso por assento e informa assentos acessíveis.
- O conteúdo recebe espaço inferior suficiente para que o resumo fixo não esconda ações ou informações.

## Arquivos e responsabilidades previstas

- `apps/eventos/components/detalhe-evento.tsx`: ajustar o destino do CTA mobile.
- `apps/eventos/app/evento/[slug]/sessao/[sessionId]/page.tsx`: apresentar a escolha de tipo de ingresso sem query como cards responsivos.
- `apps/eventos/components/mapa-assentos.tsx`: separar as visões desktop/mobile, filtrar a fileira, controlar alternância mapa/lista e integrar o resumo fixo.
- `apps/eventos/components/resumo-assentos.tsx`: expor cálculo reutilizável do total e renderizar a versão compacta fixa.
- `apps/eventos/components/__tests__/mapa-assentos.test.tsx`: cobrir seleção por fileira, estados indisponíveis, total, resumo fixo e link de checkout.
- `apps/eventos/components/__tests__/detalhe-evento-ingresso.test.tsx`: cobrir o CTA mobile apontando para a âncora de sessões.
- `apps/eventos/app/publico.test.tsx` ou novo teste da página de sessão: cobrir a tela de escolha de tipo de ingresso com cards.

## Critérios de aceite

- Em 390px de largura, o CTA mobile leva a pessoa à seção de sessões sem perder o evento.
- Em 390px de largura, os assentos não ficam sobrepostos; a lista inicial permite selecionar um assento disponível por fileira.
- O mapa continua utilizável em desktop e pode ser aberto no mobile dentro de uma área rolável.
- Após selecionar assentos, o resumo fixo informa quantidade e total e habilita o checkout somente quando a seleção está completa.
- O link gerado mantém os assentos na ordem correta, os tipos alinhados e o `sessionId` atual.
- Nenhuma chamada de backend ou regra de compra existente é alterada.
- Testes da app, lint e typecheck passam.
