# Gerador de mapa de assentos a partir de PDF e etapa de conferência — Design

**Data:** 2026-11-02
**Status:** aprovada pelo Renato em 2026-11-02
**Projeto:** 1 de 3 da reformulação do módulo de eventos

## Intenção

A escola envia a planta oficial do local em PDF e o sistema gera sozinho, em segundos, um mapa de assentos correto e bonito. Alguém da escola confere esse mapa numa tela própria e o publica, e a partir daí o mapa vale para a venda. O público é geral, formado principalmente por pais e familiares das alunas da escola de ballet, e compra como na Sympla ou num cinema. A escolha do lugar no mapa é o ponto alto da compra.

Hoje o mapa nasce errado, e por isso nenhum redesenho da tela de compra resolveu o problema. O gerador atual ([`map-detector.ts`](../../../services/api/src/modules/eventos/mapas/map-detector.ts)) só extrai números e os agrupa pela altura em que aparecem, sem usar as letras das fileiras, as cores da legenda nem a estrutura da planta. No ballet em produção isso resultou em 784 lugares espalhados em 34 "fileiras" com nomes inventados (R32, Z, V, Y…), quando o teatro tem as fileiras X e A–R. Além disso, todos os assentos ficaram com tamanho 1×1 e não há blocos nem categorias especiais. A venda do ballet está aberta desde 31/10/2026 com esse mapa.

## Os três projetos e a ordem combinada

1. **Este documento:** o gerador de mapa e a conferência.
2. **Site público:** jornada de 6 etapas no estilo B, com o Stripe embutido.
3. **Painel administrativo:** as demais telas no mesmo padrão visual.

O projeto 1 vem primeiro porque, sem o mapa certo, o site novo mostraria dados errados. Os projetos 2 e 3 terão documentos próprios.

## Objetivos

- A partir de um **PDF vetorial**, gerar automaticamente fileiras, blocos, números, categorias especiais e a geometria de cada lugar, além do palco, da entrada e das letras das fileiras.
- Desenhar o mapa gerado no **estilo B**: fundo creme, verde da identidade do Colégio Essência Feliz e lugares como cadeirinhas em contorno, cada fileira sobre uma curva suave com espaçamento uniforme.
- Oferecer uma **tela de conferência** no painel que mostre o original e o mapa gerado, aponte o que parece estranho, permita corrigir e libere a publicação só depois de tudo conferido.
- **Trocar o mapa errado do ballet** pelo mapa gerado, usando o fluxo seguro de substituição e migração de sessões.

## Fora do escopo

- Plantas em imagem (PNG, JPEG, foto) e qualquer serviço de IA com visão. **Decisão do Renato:** por enquanto, só PDF.
- Redesenho da jornada de compra (projeto 2) e das demais telas do painel (projeto 3).
- Qualquer mudança na tela atual de escolha de lugares em `apps/eventos` (veja "Tela do comprador").
- Regras de compra dos lugares especiais, como quem pode comprar um lugar exclusivo para cadeirante. Este projeto apenas registra a categoria de cada lugar, e as regras ficam para o projeto 2.
- Editor livre de mapas, com arrastar lugares, desenhar blocos ou criar um mapa do zero.
- Mudanças em reserva, checkout, pagamento ou TTL.

## Anti-objetivos

- **Vender um lugar que não existe ou com número errado.** Nenhum mapa vai para a venda sem conferência humana.
- Publicar um mapa com pontos pendentes de conferência.
- Exigir que a escola desenhe o mapa à mão. A correção deve ser pontual: trocar um número, uma categoria ou marcar "não vender".
- Depender de serviço externo pago ou criar uma segunda fonte de verdade para os lugares. O banco do Portal CEF continua sendo a única fonte.
- Copiar a planta como imagem e pôr pontos clicáveis por cima. O mapa é redesenhado a partir da estrutura entendida.

## Restrições

- O sistema está em produção. Valem as regras do repositório: português do Brasil, TDD e `pnpm turbo lint && pnpm turbo typecheck` antes de cada commit.
- **Base no trabalho do Codex.** A branch `codex/eventos-migracao-sessao-mapa` implementou a migração de sessões para um mapa novo, com exclusão segura do mapa antigo (spec `2026-11-02-eventos-migracao-sessao-mapa-design.md`), e já foi integrada ao `main` no merge `8a70d79`. Ela alterou os mesmos arquivos deste projeto: `mapas.service.ts`, `mapas.controller.ts`, `apps/eventos-admin/app/eventos/[id]/mapa/page.tsx` e `features/eventos/map-review.tsx`. A construção parte do `main` a partir desse merge e usa a operação `migrar-e-excluir`.
- O fluxo de versões existente continua valendo: importar cria um `evento_mapas` em `EM_REVISAO` com `evento_importacoes_mapa` e `evento_deteccoes_mapa`; confirmar grava `evento_mapa_assentos`, passa a versão para `CONFIRMADO` e sincroniza o inventário por sessão.
- A tabela `evento_mapa_assentos` guarda `x`, `y`, `width` e `height` como inteiros e tem a coluna `metadata` (jsonb). A tabela `evento_mapas` não tem uma coluna de layout. Se for preciso guardar dados do mapa inteiro (palco, entrada, posição das letras, tamanho da prancheta), isso provavelmente exige uma migration, e o deploy passa a ser `./scripts/deploy.sh --migrar`.
- O contrato público `PublicSeat`/`PublicMap` (`packages/shared/src/types/eventos.ts`) pode ganhar campos opcionais, como rotação, sem quebrar o checkout.

## Como o gerador funciona

Um teste descartável feito em 2026-11-02 com o PDF oficial do ballet (`Mapa plateia Novo.pdf`, uma página de 842×595 pontos) comprovou a abordagem. O processo tem três passos.

### 1. Ler

O PDF é vetorial, e o `pdfjs-dist`, que já está no projeto, entrega cada texto com a posição exata. No ballet, foram 784 números de assento e 42 letras isoladas: as fileiras X e A–R nos dois corredores, mais os "X" da legenda.

- Alguns itens de texto trazem mais de um número, como "27 26". Eles precisam ser separados pela posição de cada caractere.
- Os textos dos blocos laterais são rotacionados. A rotação do texto indica a direção da fileira naquele ponto.
- A **categoria vem da cor**. No teste, a cor de cada número foi obtida renderizando a página e lendo os pixels do próprio número (raio pequeno). Um raio grande "vazava" a cor dos vizinhos. Também dá para obter a cor pelos operadores de cor do PDF; a escolha fica com quem construir.
- A **legenda** (texto ao lado de uma amostra colorida, como "EXCLUSIVO CADEIRANTES") define o que cada cor significa. O sistema propõe o significado e a pessoa confirma na conferência. Se não houver legenda ou ela não for reconhecida, a pessoa escolhe a categoria de cada cor.
- Letras e números dentro da área da legenda são ignorados.

### 2. Montar

- **Dentro de cada bloco, os números são consecutivos e vizinhos.** O sistema liga cada número *n* ao *n+1* mais próximo na direção da fileira, com tolerância pequena na perpendicular. No teste funcionou bem: até 2,3 vezes o espaçamento típico ao longo da fileira e cerca de 6 pontos na perpendicular. Cada cadeia resultante é um bloco. As cadeias **não atravessam corredores**: uma primeira versão que permitia isso misturou fileiras nos blocos laterais, que são inclinados.
- **A letra da fileira vem do corredor.** Cada bloco recebe a letra mais próxima de uma de suas pontas. Trechos sem letra por perto (por exemplo, a segunda linha de um camarote) herdam a letra do trecho que continua a numeração, e isso vira um ponto para conferir.
- **Validação.** Para cada letra, os blocos ordenados devem formar uma numeração contínua. Saltos, repetições ou números que aparecem em dois trechos viram pontos para conferir.
- **Numeração de dois em dois** *(decisão minha)*: muitos teatros numeram os ímpares de um lado e os pares do outro. O encadeamento aceita passo 1 ou 2, escolhendo o que explica melhor cada bloco.
- **Números fora do lugar.** No ballet, os cadeirantes exclusivos têm o número escrito abaixo do ícone (R-27, 26, 14 e 13). O teste corrigiu isso com uma regra específica para essa planta. Na versão real, esses casos devem virar ponto para conferir, e a regra específica não deve ser mantida como está.

### 3. Desenhar

- Em cada bloco, o sistema ajusta uma curva suave (no teste, uma parábola sobre o eixo principal do bloco) e redistribui os lugares com espaçamento igual entre o primeiro e o último. A rotação de cada cadeira segue a tangente da curva.
- Lugares especiais podem ser maiores. Os lugares para obesos são mais largos.
- Palco, entrada e letras das fileiras são desenhados a partir das posições lidas no PDF.

### Resultado esperado no PDF do ballet (critério de aceitação)

O teste produziu o resultado abaixo, conferido contra a planta. Use-o como fixture de teste.

| Fileira | Lugares | Blocos (direita · centro · esquerda) |
|---|---|---|
| X | 34 | 5 + 5 (camarote direito, duas linhas) · 14 · 5 + 5 (camarote esquerdo, duas linhas) |
| A | 35 | 11 · 13 · 11 |
| B | 37 | 11 · 15 · 11 |
| C | 39 | 12 · 15 · 12 |
| D | 39 | 12 · 15 · 12 |
| E | 41 | 13 · 15 · 13 |
| F | 41 | 13 · 15 · 13 |
| G | 43 | 14 · 15 · 14 |
| H | 43 | 14 · 15 · 14 |
| I | 39 | 12 · 15 · 12 |
| J–O | 45 cada | 15 · 15 · 15 |
| P | 43 | 14 · 15 · 14 |
| Q | 43 | 14 · 15 · 14 |
| R | 39 | 12 · 15 · 12 |

Total: **786 lugares em 19 fileiras**. Por categoria: 4 exclusivos para cadeirante, 12 opcionais para cadeirante, 12 opcionais com acesso externo, 8 especiais para obesos e 750 comuns. Deve restar **um ponto para conferir**: os números da fileira R escritos abaixo dos ícones de cadeirante.

Atenção: os blocos laterais são inclinados e enganam quem lê a olho. A fileira I à esquerda vai do 39 (obeso) ao 28, e a fileira R tem um bloco esquerdo do 39 ao 28. O algoritmo acerta porque segue a numeração.

## Entrada aceita

- Somente PDF.
- **PDF escaneado** (imagem dentro do PDF, sem texto legível) é recusado com uma mensagem clara, orientando a enviar o PDF exportado do programa em que a planta foi desenhada *(decisão minha)*.
- **PDF com várias páginas:** a primeira versão pede para a pessoa escolher a página que contém a planta *(decisão minha)*.
- O arquivo original continua guardado sem alterações, como hoje.

## Tela de conferência (painel)

Ela substitui a tela atual de "Mapa e revisão", que é uma lista de botões com campos x/y. Já sai no estilo B, e o esboço aprovado para discussão mostra:

- **Etapas** no topo: Enviar planta → Conferir → Publicar.
- **Resumo** com o total de fileiras, blocos, lugares e lugares de cada categoria, para bater com a planta.
- **A planta original e o mapa gerado lado a lado**, com a opção de sobrepor um ao outro.
- **Pontos para conferir** listados e marcados no mapa. Clicar num ponto leva ao local.
- **Edição por clique:** ao selecionar um lugar, a pessoa troca a fileira, o número ou a categoria, ou marca "não vender". A seleção de vários lugares para trocar a categoria de uma vez fica a critério de quem construir.
- **Lugar que sobra ou que falta** *(decisão minha)*: dá para **excluir** um lugar detectado por engano, que some do mapa (diferente de "não vender", que o mantém visível como bloqueado). Dá também para **adicionar** um lugar que o gerador perdeu: a pessoa clica no ponto da planta sobreposta e informa a fileira e o número. Isso não é um editor livre, porque não há arrastar, desenhar blocos nem criar mapa do zero. Para problemas maiores, o caminho é reenviar o PDF.
- **Legenda:** a pessoa confirma o significado de cada cor encontrada.
- **Publicar:** só libera quando todos os pontos foram conferidos. A auditoria registra automaticamente quem alterou o quê e quando. Hoje cada correção exige um motivo; aqui o motivo passa a ser opcional e é pedido uma única vez, ao publicar *(decisão minha, para não travar a conferência)*.
- Reenviar outro PDF descarta a proposta em revisão e gera uma nova.

## Categorias de lugar *(decisão minha)*

As categorias formam uma **lista fixa**, e não texto livre, porque o projeto 2 vai montar as regras de compra sobre elas:

| Categoria | Significado | `accessible` |
|---|---|---|
| Comum | Lugar padrão | não |
| Cadeirante | Espaço exclusivo para cadeira de rodas | sim |
| Opcional para cadeirante | Lugar comum que pode ser convertido em espaço para cadeira de rodas | sim |
| Especial para obeso | Assento mais largo, para pessoa obesa | sim |

"Acesso externo" não é uma categoria, e sim uma **marca adicional** no lugar: indica que se chega a ele por um acesso externo. No ballet, os 12 lugares em ciano são "Opcional para cadeirante" com essa marca. A legenda de cada planta é associada a uma dessas categorias na conferência. Se surgir uma legenda que não se encaixe, a lista é ampliada num projeto futuro, e não com texto livre.

## Publicação e troca do mapa

- Publicar confirma a versão e, quando for o caso, substitui o mapa padrão do evento usando os fluxos existentes (`substituirMapaPadrao` e a operação `migrar-e-excluir`, que veio do trabalho do Codex).
- **Primeiro uso real: o ballet.** Gerar o mapa a partir do PDF oficial, conferir, publicar e migrar a sessão de 07/12/2026 para o mapa novo. Em 02/11, o mapa público mostrava os 784 lugares disponíveis, o que indica que não houve vendas no mapa errado, mas isso precisa ser confirmado no momento da troca. O evento ainda não foi divulgado (informação do Renato em 02/11), então não é preciso pausar a venda, mas **a troca deve acontecer antes da divulgação**.
- **Se a sessão do ballet tiver pedidos de teste** *(decisão minha)*: a operação `migrar-e-excluir` recusa com `SESSION_HAS_DEPENDENCIES` qualquer sessão que tenha reservas, mesmo expiradas, ingressos, check-ins ou operações. Ver os 784 lugares disponíveis não prova que não houve checkout, porque reservas expiradas voltam a aparecer como livres. Se isso acontecer, **não se relaxa a regra do Codex**: cria-se uma sessão nova, com a mesma data e horário, sobre o mapa novo, e a sessão antiga é despublicada. Isso só é aceitável porque o evento não foi divulgado. Se houver alguma venda real paga, a troca para e o caso volta para o Renato.
- **Capacidade** *(decisão minha)*: ao publicar, a capacidade da sessão passa a ser o número de lugares vendáveis do mapa novo (786 no ballet, hoje provavelmente 784), para a checagem de prontidão não acusar diferença.

## Tela do comprador

A tela atual de escolha de lugares **não muda neste projeto**. O Renato decidiu divulgar o ballet só depois que o site novo (projeto 2) estiver pronto, e é o projeto 2 que vai desenhar o mapa do comprador a partir da geometria gerada aqui.

Por isso, o componente que desenha o mapa no estilo B na tela de conferência deve ser pensado para ser **reaproveitado no projeto 2**, em modo de escolha de lugares. Se for preciso expor o layout ou a rotação no contrato público, isso pode ser feito aqui ou no projeto 2, conforme ficar mais simples.

## Referências visuais

As imagens dos esboços feitos na conversa com o Renato estão em [`2026-11-02-eventos-gerador-mapa/`](2026-11-02-eventos-gerador-mapa/):

- `direcao-visual.png`: as três direções de mapa mostradas. **O Renato escolheu a B**, a do meio.
- `esboco-conferencia.png`: esboço da tela de conferência.
- `teste-mapa-gerado.png`: o mapa que o teste gerou a partir do PDF do ballet, no estilo B.
- `jornada-compra.png`: a jornada de compra validada para o projeto 2, como contexto.

Valores do estilo B usados nos esboços:
- fundo `#fffdf8`, texto `#24302c`, texto secundário `#69736e`, linhas `#e5e8df`;
- verde da marca `#a3d154` nos botões, lugar escolhido `#7fae2e` com contorno `#4d6a17`;
- lugar livre branco com contorno `#9fb08a`, ocupado `#e4e6e1`, cadeirante `#3b82f6`;
- palco `#f1ead9`;
- fontes Outfit (títulos) e DM Sans (texto), as mesmas já usadas em `apps/eventos`;
- cada cadeirinha é um retângulo arredondado com uma faixa mais escura na base, como encosto, girado conforme a fileira.

As cores de opcional (contorno azul), acesso externo (ciano) e obeso (roxo) que aparecem no esboço da conferência são sugestões.

## Decisões tomadas

**Pelo Renato:**
- Haverá uma etapa obrigatória de conferência antes da publicação.
- Aceitar apenas PDF, sem IA paga por enquanto.
- O gerador será próprio, porque não existe ferramenta pronta que faça isso (pesquisa de 02/11: Seats.io, Yapsody, SimpleTix e Tickera traçam à mão; SeatLayer, SeatPlan.io e BrightStar não atendem).
- O estilo visual é o B, claro e com a cara da escola.
- A ordem dos projetos é gerador, depois site público, depois painel.
- O ballet só será divulgado depois que o site novo (projeto 2) estiver pronto. Por isso, a tela atual de compra não recebe ajustes neste projeto.

**Minhas (marcadas no texto, podem ser revistas):**
- Numeração de dois em dois suportada.
- PDF escaneado é recusado com orientação.
- PDF com várias páginas pede a escolha da página.
- O motivo da correção é único e opcional, pedido na publicação.
- As regras de compra dos lugares especiais ficam para o projeto 2.
- As categorias formam uma lista fixa, e "acesso externo" é uma marca adicional.
- Na conferência é possível excluir e adicionar lugares pontualmente.
- Se houver pedidos de teste, o ballet ganha uma sessão nova em vez de relaxar a regra de migração.
- A capacidade da sessão é ajustada ao mapa publicado.

## O que fica com quem construir

- Onde e como guardar a geometria (escala dos inteiros, rotação e bloco em `metadata` ou em colunas novas) e o layout do mapa (palco, entrada, letras), incluindo se haverá migration.
- Como obter a cor de cada número: renderização ou operadores do PDF.
- Os limites exatos do encadeamento e da suavização, a partir dos valores que funcionaram no teste.
- A estrutura de componentes da tela de conferência e a biblioteca de zoom/pan. O `d3-zoom` já é usado em `apps/eventos`.
- Onde o processamento roda (na requisição ou em job) e se o progresso aparece na tela, desde que o resultado saia em poucos segundos para um mapa do tamanho do ballet.
- Os testes: o PDF do ballet como fixture, mais casos sintéticos para numeração de dois em dois, PDF escaneado, PDF sem legenda e números repetidos.
