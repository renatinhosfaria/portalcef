# Design: reconstrução da camada pública de Eventos

**Data:** 2026-10-31  
**Status:** aprovado

## Intenção

Transformar a vitrine pública de Eventos em uma experiência de descoberta e
compra de ingressos com a fluidez percebida em plataformas como Sympla e em
sites de redes de cinema como Cinemark e Cinépolis, mantendo identidade própria
do Colégio Essência Feliz.

A pessoa visitante deve conseguir entender rapidamente quais eventos estão
disponíveis, abrir um evento, escolher uma sessão, visualizar a disponibilidade
dos assentos, concluir o checkout como convidada e consultar o pedido. A
reformulação será feita somente em `apps/eventos`; o backend, o painel
administrativo, o banco, o Stripe e as regras comerciais atuais continuam como
fonte de verdade.

## Contexto atual

`apps/eventos` já é uma aplicação Next.js pública com as rotas:

- `/` — catálogo;
- `/evento/[slug]` — detalhe do evento;
- `/evento/[slug]/sessao/[sessionId]` — sessão e mapa;
- `/checkout` — dados do comprador e participantes;
- `/pedido/[orderNumber]` — consulta e retorno do pagamento.

O app usa Next.js 15.5, React 19, TypeScript, Tailwind CSS e Lucide. Os
componentes atuais funcionam, mas a apresentação ainda é básica: o layout tem
um cabeçalho simples, os cards não exibem `imageUrl`, e data, local, preço,
disponibilidade e próximos passos têm pouca hierarquia visual. O contrato
público já fornece os dados necessários para catálogo, detalhe, sessões,
ingressos, local, mapa e pedido.

O monorepo já possui o pacote compartilhado `@essencia/ui`, baseado em
componentes acessíveis do Radix/shadcn. A vitrine poderá reutilizar esses
primitivos e criar componentes específicos do domínio de Eventos sem criar um
segundo framework ou alterar o painel administrativo.

## Objetivos

1. Criar uma identidade visual pública consistente, acolhedora e adequada a
   famílias, com hierarquia clara e aparência atual.
2. Tornar o catálogo útil para descoberta: imagem do evento, título, categoria,
   data, local, preço inicial e disponibilidade devem ser compreendidos sem
   abrir cada card.
3. Apresentar o detalhe do evento como uma página de compra: imagem, resumo,
   informações principais, descrição, local, políticas e sessões organizadas
   por data/horário.
4. Aproximar a escolha de sessão da experiência de cinema, com horários claros,
   estado de disponibilidade e ação direta para selecionar ingressos.
5. Tornar o mapa de assentos legível no celular e no desktop, preservando os
   estados `available`, `reserved`, `sold` e `blocked`, categorias acessíveis e
   a regra de que somente assentos disponíveis podem ser selecionados.
6. Melhorar checkout e consulta do pedido com resumo persistente, progresso
   compreensível, estados de carregamento, erro e sucesso, sem mudar os
   endpoints ou as regras de negócio existentes.
7. Preservar SEO básico, acessibilidade, performance e navegação sem login.
8. Usar a base tecnológica atual com práticas modernas: Server Components para
   leitura, ilhas client somente nas interações, `next/image`, tokens de design,
   primitives acessíveis e animações discretas quando ajudarem a compreensão.

## Fora de escopo

- Trocar Next.js, React, TypeScript ou o mecanismo de build do monorepo.
- Alterar `apps/eventos-admin`, autenticação, banco, Stripe, preços, reserva,
  inventário, políticas ou regras de compra.
- Criar conta obrigatória, marketplace de vários organizadores ou busca
  avançada entre cidades e escolas.
- Criar um CMS ou novos campos administrativos para sustentar a primeira versão
  visual.
- Copiar marca, textos, imagens, código ou layout proprietário de Sympla,
  Cinemark ou Cinépolis.
- Substituir o mapa transacional por uma imagem não interativa ou aceitar do
  navegador preço, disponibilidade, `schoolId` ou qualquer outra fonte de
  verdade comercial.

## Anti-objetivos

- Uma interface chamativa que dificulte descobrir o próximo passo.
- Animações que atrasem o conteúdo ou prejudiquem pessoas com preferência por
  movimento reduzido.
- Cards e sessões sem indicação confiável de data, local ou disponibilidade.
- Assento reservado, vendido ou bloqueado aparecendo como selecionável.
- Duplicação de regras de compra no frontend.

## Abordagens consideradas

### Evolução incremental dos componentes atuais

Manter a estrutura visual existente e ajustar cores, tipografia, espaçamentos,
cards e formulários. É a alternativa mais rápida e com menor superfície de
mudança, mas tende a preservar limitações da estrutura atual e não entrega a
experiência de descoberta e compra que motivou a reformulação.

### Reconstrução da camada pública dentro de `apps/eventos` — escolhida

Manter Next.js, React, TypeScript, Tailwind, contratos e rotas públicas, mas
refazer o shell, o sistema visual e os componentes da jornada. Páginas de
leitura usam Server Components; mapa, seletor de sessão, filtros leves e
checkout usam componentes client isolados. O `@essencia/ui` será reutilizado
quando seus primitives atenderem ao caso, com componentes específicos de
Eventos quando necessário.

Essa alternativa permite uma mudança profunda de UX sem tocar no backend ou no
painel. Também mantém SSR, SEO, otimização de imagens, deploy e observabilidade
já integrados ao monorepo.

### Novo frontend com outro framework

Criar uma aplicação separada em outro framework ou modelo de build. Isso
isolaria ainda mais o código, mas duplicaria configuração, dependências,
deploy, contratos e padrões de acessibilidade. Não há uma capacidade necessária
à vitrine que justifique esse custo.

## Direção escolhida

A implementação seguirá a segunda abordagem. A stack principal permanece
inalterada. A modernização será feita na camada pública com:

- tokens de cor, tipografia, raio, sombra, espaçamento e estados em CSS/Tailwind;
- primitives acessíveis do `@essencia/ui` e `lucide-react` para controles e ícones;
- `next/image` para capas e imagens remotas autorizadas no app;
- composição de Server Components e componentes client pequenos;
- transições curtas e respeitosas, sem depender de animação para comunicar
  estado;
- URLs existentes preservadas para não quebrar links públicos.

## Experiência pública

### Shell público

O cabeçalho terá marca do Colégio Essência Feliz, nome da área de Eventos e
acesso visível à consulta de pedido. O rodapé concentrará contato e links
institucionais disponíveis no contrato atual. O shell será responsivo, sem
qualquer dependência de sessão administrativa.

### Catálogo

A página inicial apresentará uma introdução curta e uma grade responsiva de
eventos publicados. Cada card terá imagem ou fallback visual, categoria,
título, data inicial quando existir, local, preço a partir de e estado de
disponibilidade. O card inteiro será navegável e manterá contraste, foco de
teclado e alvo de toque adequado.

O estado vazio explicará que não há eventos disponíveis. O estado de erro
continuará distinto do vazio e oferecerá uma ação de tentativa novamente sem
redirecionar para login.

### Detalhe do evento

A página terá uma abertura visual com imagem, título, resumo e metadados
principais. A descrição, local, acessibilidade, política de cancelamento e
contato ficarão organizados em blocos legíveis. As sessões serão agrupadas por
dia ou apresentadas em uma sequência temporal equivalente, com horário, local,
janela de venda, disponibilidade e ação para escolher ingressos.

Quando houver mais de um tipo de ingresso, a escolha deverá ser explícita antes
do mapa. Quando houver uma única opção, a página poderá conduzir diretamente à
seleção de assentos.

### Sessão e mapa

O visitante verá a sessão escolhida, o tipo de ingresso, a legenda dos estados
e o mapa. O resumo dos assentos selecionados e a ação de continuar ficarão
visíveis sem esconder o mapa; em telas pequenas, esse resumo poderá assumir a
forma de uma barra inferior ou painel recolhível.

Assentos indisponíveis serão visualmente distintos e terão `disabled`. Assentos
acessíveis manterão sua categoria e descrição. A seleção continuará enviando
somente IDs e contexto necessário para a rota de checkout; a API continuará
recalculando preço e disponibilidade.

### Checkout e pedido

O checkout exibirá um resumo do evento, sessão, assentos e dados necessários,
seguido pelos participantes, políticas e pagamento. A ordem visual será clara,
com validações próximas dos campos, estados de processamento e mensagens para
reserva expirada, conflito de assento, limite de tentativas e retorno do
Stripe.

A consulta do pedido manterá o acesso por número/código existente e apresentará
status, sessão, itens e instruções de pagamento de forma compreensível. Nenhum
novo dado administrativo ou pessoal será exposto.

## Decisões deixadas ao builder

- Paleta exata, escala tipográfica e composição visual, respeitando o logo e a
  identidade do colégio.
- Organização final dos componentes e nomes de arquivos dentro de `apps/eventos`.
- Escolha entre os primitives já existentes e novos componentes locais quando
  houver diferença de comportamento ou estilo.
- Forma exata do resumo fixo no mapa para cada breakpoint.
- Uso de uma biblioteca de animação adicional somente se CSS e primitives
  existentes não cobrirem o comportamento com simplicidade.
- Ajustes mínimos de `next.config.js`, Tailwind, dependências e testes do app
  que sejam necessários para suportar a camada visual.

## Respostas da revisão do builder

Uma revisão independente apontou ambiguidades de implementação. Todas foram
resolvidas com base nos contratos atuais, nas regras já aprovadas e no limite de
manter o backend sem mudanças:

- Sessão publicada sem `mapId` não será tratada como ingresso geral. A vitrine
  exibirá a sessão como não vendável até que exista inventário de assentos; não
  haverá novo fluxo de capacidade geral nesta reformulação.
- Um pedido poderá combinar tipos de ingresso diferentes, porque a API aceita
  `ticketTypeId` por assento e a política atual permite combinar pacote com
  ingressos individuais. A UI mostrará o tipo escolhido no resumo de cada
  assento e enviará os IDs alinhados aos assentos.
- A reserva começará quando o comprador enviar o checkout, preservando o fluxo
  atual e a idempotência. A navegação pelo mapa não iniciará TTL; mensagens de
  expiração e conflito aparecerão quando a API devolver esses estados.
- O mapa respeitará `x`, `y`, `width` e `height` dos assentos, com zoom/pan ou
  escala equivalente quando necessário. Uma lista acessível de assentos e a
  legenda complementar serão mantidas para quem não usa a representação visual.
- Datas e horários serão agrupados e formatados no fuso canônico
  `America/Sao_Paulo`, evitando divergência entre servidor e navegador.
- As imagens serão carregadas somente de hosts de armazenamento públicos já
  autorizados pelo projeto. URL ausente ou falha de carregamento usará fallback
  visual da marca; o app não aceitará host remoto arbitrário no `next/image`.
- Após retorno bem-sucedido do Stripe, a página poderá consultar o pedido em um
  polling curto e limitado, com ação manual disponível. O polling usará apenas
  o endpoint público existente e terminará quando o status for conclusivo ou o
  limite de tentativas for atingido.
- Será criada uma rota pública dedicada `/pedido/consulta` para o formulário de
  consulta. A rota dinâmica `/pedido/[orderNumber]` continuará representando um
  pedido específico.
- O rodapé terá apenas links e informações estáticas já conhecidas, como marca,
  consulta de pedido e portal institucional; não serão inventados contatos ou
  textos que não estejam no contrato do produto.
- `eligibility` de ingresso e `category` de assento serão apresentados como
  informação e orientação. A vitrine não bloqueará combinações com base nesses
  campos enquanto o backend não expuser uma regra transacional correspondente.

## Critérios de aceitação do design

- Todas as rotas públicas atuais continuam acessíveis e sem autenticação.
- O catálogo e o detalhe usam os dados públicos existentes sem acessar banco ou
  serviço privado diretamente.
- A imagem do evento aparece quando `imageUrl` existe e há fallback quando não
  existe.
- Data, local, preço inicial, disponibilidade e próximo passo têm hierarquia
  clara em desktop e celular.
- Sessões com vários horários e tipos de ingresso permanecem inequívocas.
- O mapa preserva os quatro estados de assento, acessibilidade e bloqueio de
  seleção para estados indisponíveis.
- Checkout e consulta mantêm contratos, idempotência, políticas e regras de
  compra atuais.
- Estados de carregamento, vazio, erro, reserva expirada e sucesso são
  compreensíveis e acessíveis.
- O app passa testes, lint, typecheck, build e verificações de acessibilidade
  apropriadas ao escopo.

## Próxima etapa

Depois da aprovação deste documento, será elaborado o plano de implementação
com tarefas pequenas, testes e ordem de execução. Nenhum código de produto será
alterado antes dessa aprovação.

