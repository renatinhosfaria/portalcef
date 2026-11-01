# Mapa de assentos SVG interativo — Design

## Intenção

Reestruturar a experiência de seleção de assentos da vitrine pública em `apps/eventos`. A pessoa deve conseguir reconhecer a planta do teatro, aproximar uma região, escolher os lugares desejados, revisar a seleção e avançar para o checkout com clareza em desktop e celular.

A seleção no mapa será apenas local. A reserva temporária continuará sendo criada pelo backend somente quando o comprador avançar para o checkout, preservando o contrato e as regras atuais de compra.

## Contexto atual

O componente [`apps/eventos/components/mapa-assentos.tsx`](../../../apps/eventos/components/mapa-assentos.tsx) renderiza os lugares como elementos HTML posicionados por coordenadas relativas. A tela já possui estados de disponibilidade, seleção por fileira no celular, resumo dos ingressos e serialização para o checkout. O problema principal é a densidade da planta em telas pequenas e a ausência de zoom, pan, foco por fileira e uma referência espacial confortável.

O contrato público fornece `PublicMap` com `sessionId`, `mapId` e assentos que possuem `id`, `rowLabel`, `seatNumber`, `x`, `y`, `width`, `height`, `category`, `accessible` e `state`. Não será necessário alterar esse contrato.

## Objetivos

- Renderizar a planta como SVG responsivo, preservando a geometria recebida da API.
- Permitir zoom, pan, pinch, reset e foco programático em regiões ou fileiras.
- Permitir seleção de assentos disponíveis com mouse, toque, teclado e leitor de tela.
- Diferenciar visualmente assentos disponíveis, selecionados, reservados, vendidos e bloqueados sem depender apenas de cor.
- Manter a lista por fileira como alternativa acessível e como visão inicial no celular.
- Atualizar quantidade, tipos de ingresso e total no resumo atual.
- Avançar para o checkout usando `assentos`, `ticketTypeIds` e `sessionId` já existentes.
- Garantir que clicar no mapa não crie requisição de reserva.

## Fora do escopo

- Alterar backend, banco, painel administrativo, Stripe ou regras de elegibilidade.
- Criar holds antecipados ao selecionar um assento.
- Alterar o TTL de reserva temporária ou o endpoint de checkout.
- Criar editor administrativo, importador de PDF/SVG ou novo formato de mapa.
- Migrar o inventário para Seats.io, SeatLayer ou qualquer outro fornecedor.
- Adicionar Canvas, WebGL, Konva ou PixiJS nesta etapa.

## Anti-objetivos

- Não esconder a única forma de seleção atrás de um mapa visual que não funcione com teclado ou leitor de tela.
- Não transformar o clique em assento em uma operação irreversível ou em uma reserva silenciosa.
- Não introduzir um segundo estado de disponibilidade que possa divergir do backend.
- Não sacrificar o fluxo mobile para manter todos os rótulos visíveis simultaneamente.

## Abordagens consideradas

### 1. SVG próprio em React com `d3-zoom` — escolhida

A aplicação continua controlando os dados e o estado de seleção. Um SVG renderiza os lugares em grupos e o `d3-zoom` controla pan, wheel, pinch, limites e transformações. A lista existente permanece como visão alternativa e acessível.

Vantagens: controle completo sobre dados e aparência, integração direta com `PublicMap`, acessibilidade implementável, nenhum custo por assento e comportamento próximo ao observado na Bileto. O custo é implementar a camada visual, gestos, foco e testes.

### 2. `@alisaitteke/seatmap-canvas`

O pacote oferece um renderer D3/SVG com seleção, blocos e estilos. Reduz o trabalho inicial, mas a versão MIT está congelada e não recebe novos recursos. A estrutura de dados e os eventos precisariam ser adaptados, e a acessibilidade continuaria exigindo validação própria.

### 3. Seats.io ou SeatLayer

Os serviços oferecem renderer, disponibilidade, holds e ferramentas de operação. Reduzem o trabalho de infraestrutura do mapa, mas introduzem custo, dependência externa e outra fonte de estado. O modelo de hold automático também não corresponde à decisão de manter a seleção local até “Continuar”.

A abordagem 1 foi aprovada porque resolve o problema de UI/UX sem alterar o domínio de reservas nem transferir o inventário para outro sistema.

## Decisões de interação

- Desktop começa com o mapa ajustado à área disponível.
- O mapa começa como visão principal no desktop e a lista começa como visão principal no celular; o alternador mapa/lista fica disponível em todos os tamanhos.
- O mapa terá controles visíveis de aumentar zoom, reduzir zoom e restaurar o enquadramento.
- O mapa aceitará arraste, roda do mouse e gesto de pinça dentro da área visual.
- A seleção de um assento disponível alternará entre selecionado e não selecionado.
- Assentos indisponíveis permanecerão visíveis, mas não terão ação de seleção.
- A seleção será mantida em estado local até o clique em “Continuar para checkout”.
- O resumo mostrará assentos, tipos de ingresso, quantidade e total; a alteração do tipo de ingresso continuará disponível.
- O botão “Continuar” só terá destino quando todos os itens tiverem um tipo de ingresso válido.
- O checkout continuará responsável por chamar a reserva temporária no backend.
- Se o backend rejeitar um assento no checkout, o comprador verá o conflito e retornará ao mapa com a seleção reidratada; os lugares que ainda estiverem disponíveis continuarão selecionados e o lugar que mudou de estado será identificado para nova escolha.

## Decisões técnicas

- Usar SVG com `viewBox` derivado dos limites de `x`, `y`, `width` e `height` dos assentos.
- Usar somente o módulo `d3-zoom`, evitando a dependência do pacote completo D3.
- Manter a transformação de zoom/pan em uma camada `<g>` para evitar recalcular o layout de cada assento durante o gesto.
- Renderizar assentos como formas SVG com estado visual, rótulo e metadados acessíveis.
- Tornar assentos disponíveis focáveis, com ativação por Enter e Espaço e foco visível.
- Oferecer a lista por fileira como modo acessível independente do mapa, sem remover o mapa para usuários que preferem referência espacial.
- Disponibilizar o alternador de lista em desktop, tablet e celular; a lista não será um recurso exclusivo de breakpoint.
- Mostrar rótulos visuais progressivamente conforme o zoom aumenta; nomes e estados continuam disponíveis para tecnologias assistivas.
- Separar os controles de zoom da superfície SVG para que sejam acionáveis por teclado e não conflitem com o arraste.
- Não persistir seleção em banco, Redis ou sessão antes do checkout.
- Usar a URL como transporte da seleção ao navegar entre mapa e checkout: `assentos` e `ticketTypeIds` serão enviados no retorno ao mapa, sem adicionar dados pessoais.
- Ao reidratar, reconciliar os IDs com o mapa atual: assentos ainda disponíveis voltam selecionados; assentos que mudaram para reservado, vendido ou bloqueado são removidos da seleção e aparecem em mensagem de conflito.

## Arquivos e responsabilidades previstas

- `apps/eventos/components/mapa-assentos.tsx`: composição das visões, seleção local, mapa SVG, lista e integração com resumo.
- `apps/eventos/components/mapa-assentos-svg.tsx`: renderer SVG, controles, transformações e eventos de interação.
- `apps/eventos/components/mapa-assentos-utils.ts`: limites, viewBox, foco de fileira e serialização já usada pelo checkout.
- `apps/eventos/components/resumo-assentos.tsx`: resumo detalhado e resumo fixo, sem mudança no contrato de checkout.
- `apps/eventos/app/evento/[slug]/sessao/[sessionId]/page.tsx`: ler a seleção retornada na URL, buscar o estado atual do mapa e repassar a reidratação ao componente.
- `apps/eventos/app/checkout/page.tsx` e `apps/eventos/components/formulario-checkout.tsx`: construir o retorno ao mapa com sessão, assentos e tipos, e expor o conflito de disponibilidade.
- `apps/eventos/components/__tests__/mapa-assentos.test.tsx`: seleção, estados, teclado, foco, total, serialização e ausência de reserva durante o clique.
- `apps/eventos/scripts/smoke-publico.mjs` ou novo cenário Playwright: viewport mobile, viewport desktop, zoom, seleção, lista, resumo e avanço.
- `apps/eventos/package.json`: adicionar apenas a dependência necessária para o zoom.

## Critérios de aceite

- O mapa SVG ocupa a área disponível sem sobrepor rótulos na escala inicial.
- A pessoa consegue aproximar, arrastar, restaurar o mapa e localizar uma fileira.
- Um assento disponível pode ser selecionado e desmarcado por toque, mouse e teclado.
- Assentos reservados, vendidos e bloqueados não podem ser selecionados.
- A lista continua funcional e sincronizada com o mapa em todos os tamanhos, iniciando como visão principal no celular.
- O resumo atualiza quantidade, tipos e total sem chamada de reserva.
- Nenhuma requisição de reserva é enviada ao clicar em assentos; a reserva só ocorre no fluxo de checkout.
- O link de checkout preserva a ordem dos assentos, os tipos correspondentes e o `sessionId`.
- Um conflito retornado pelo backend devolve o usuário ao mapa com a seleção reidratada; assentos ainda disponíveis permanecem selecionados e o assento conflitante é identificado.
- Os testes da aplicação, lint, typecheck e build passam.
- A validação Playwright cobre pelo menos 390×844 e 1440×1000.

## Questões deixadas para a implementação

A implementação poderá escolher a forma visual de cada assento, os limites numéricos do zoom, a estratégia exata de foco e a composição dos controles, desde que preserve os objetivos, as decisões e os critérios de aceite acima.
