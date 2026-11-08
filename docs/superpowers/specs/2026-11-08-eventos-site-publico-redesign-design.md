# Reforma visual e de experiência do site público de eventos

Data: 2026-11-08
App: `apps/eventos` (https://eventos.portalcef.com.br), com ajustes em `services/api/src/modules/eventos`, `packages/shared` e `packages/db`.

## Por que

O Renato acha o site público de eventos **amador e pouco confiável**. O primeiro evento, o Espetáculo de Ballet 2026 (7/12/2026, Teatro Municipal de Uberlândia, 752 lugares numerados), ainda não teve as vendas abertas nem divulgadas. A reforma precisa estar no ar antes da divulgação. Não há pressa de entrega: o trabalho pode ser feito com calma e publicado de uma vez.

A referência de seriedade citada pelo Renato é o **Sympla**. Os sinais de confiança que ele aprovou como direção:

1. arte do evento inteira, num topo forte com título, data e local;
2. caixa de compra sempre à vista;
3. quem organiza o evento, com contato oficial;
4. formas de pagamento e segurança perto do dinheiro;
5. políticas resumidas, sem textão;
6. uma única cor de ação em todas as páginas.

O site deve ter a cara do Colégio Essência Feliz, não a do Sympla.

### O que está errado hoje (levantado em 2026-11-08)

- As páginas não parecem do mesmo site: o catálogo usa o verde do colégio, a página do evento usa botões azuis, e a escolha de assentos e o checkout ficam sem margem, colados na borda esquerda da tela.
- A arte do evento aparece cortada na página do evento.
- **Mapa de assentos:** os 752 lugares, num desenho de cerca de 7.000 × 5.000 unidades, são espremidos numa caixa de 384 px de altura. Cada assento fica com uns 8 px, em cores apagadas. Não há palco nem letras das fileiras. No celular, o mapa vira uma lista de cartões, um por assento (35 a 45 por fileira).
- O checkout lista as 5 políticas com o texto inteiro e com nomes internos (`CANCELAMENTO_REEMBOLSO (Versão 1)`). O botão fica cinza sem dizer o que falta.
- Depois de pagar, a pessoa vê só "Itens: 3". O sistema **já gera um ingresso com QR code por lugar** quando o pagamento é aprovado (`evento_ingressos.qr_payload`), mas nunca mostra esses ingressos.
- O módulo de eventos não envia e-mail.

## Objetivos

1. Todas as páginas públicas com um visual único, atual e confiável, pensado primeiro para o celular. O palpite, não confirmado, é que a maioria chega por um link no WhatsApp.
2. Um mapa de assentos que dá para usar: palco visível, letras das fileiras, assentos legíveis e um celular de verdade (zoom em vez de lista).
3. Lugares guardados por 15 minutos a partir do "Continuar" no mapa, com relógio visível no checkout.
4. Mapa que se atualiza sozinho enquanto a pessoa escolhe.
5. Acabamento com animações sutis e vibração leve ao escolher um lugar.
6. Depois do pagamento, a confirmação **é o ingresso**: um cartão por lugar, com QR code e número curto.
7. **A pessoa nunca sai do site do colégio.** O pagamento com cartão ou Pix é feito dentro do site, no formulário embutido da Stripe. Isso foi decisão do Renato em 2/11/2026, confirmada em 8/11/2026.

## Fora do escopo (decisão do Renato)

Ideias discutidas e **recusadas**, que não devem ser implementadas:

- perguntar "quantas pessoas?" e sugerir automaticamente os melhores lugares juntos;
- contador de inteira/meia no lugar da escolha por assento;
- prévia do link no WhatsApp (imagem e título por evento, via Open Graph).

Também fora do escopo:

- **conferência na porta** (tela de leitura do QR e digitação do número do ingresso, que hoje é um aviso vazio em `apps/eventos-admin/app/eventos/[id]/check-in`) e **envio do ingresso por e-mail**. Os dois ficam para um projeto separado, logo em seguida, que precisa estar pronto antes de 7/12/2026. Esta reforma só garante que o ingresso exibe o QR e o número que esse projeto vai conferir;
- mudanças no painel administrativo, nos preços, nas ofertas e no cálculo de desconto;
- novas formas de pagamento. O código já pede `card` e `pix` à Stripe em `services/api/src/modules/payments/payments.service.ts`;
- qualquer mudança no pagamento da **loja**. O `PaymentsService` é compartilhado com `services/api/src/modules/shop`, e a loja continua com a página hospedada da Stripe.

## O que não pode acontecer (anti-objetivos)

- **Prometer na tela o que o sistema não faz.** Isso já aconteceu duas vezes nos esboços ("ingresso enviado por e-mail" e "lugares guardados enquanto você preenche os dados") e foi corrigido. Todo texto de confiança precisa ser verdade no código que vai ao ar.
- Parecer cópia do Sympla em marca, cores ou layout idêntico.
- Perder comportamentos que já funcionam e têm teste: limite de 20 lugares por pedido; recuperação da seleção após conflito (`?conflito=disponibilidade`); reidratação da seleção pela URL; cálculo e exibição do desconto de volume; chave de idempotência da reserva; tratamento de 409 e 429.
- Piorar a acessibilidade. O mapa e a lista continuam operáveis por teclado e leitor de tela.
- Expor QR code ou número de ingresso para quem só sabe o número do pedido.

## Direção visual

Esboços aprovados, guardados só localmente no servidor e fora do git. Servem de referência visual; **este documento é a fonte da verdade**. Os esboços estão desatualizados em dois pontos: o desenho dos assentos (valem as cadeirinhas do estilo B, descritas abaixo) e o pagamento (vale o formulário embutido, e não o redirecionamento para a Stripe).

- `docs/superpowers/specs/2026-11-02-eventos-gerador-mapa/direcao-visual.png`: estilo B do mapa, escolhido em 2/11/2026 (versionado no git);

- `/var/www/essencia/.superpowers/brainstorm/3237915-1794149378/content/confianca-pagina-evento.html`: página do evento (computador e celular);
- `.../content/assentos-proposta.html`: escolha de assentos, com os 752 lugares reais;
- `.../content/checkout-ingresso.html`: checkout e ingresso.

Decisões de linguagem visual:

- **Cores:** fundo creme claro (`#faf9f5`), cartões brancos, texto `#1f2a24`. **Uma única cor de ação, verde-escuro** (`#3f6f12`, texto branco), em todos os botões principais de todas as páginas. O azul atual sai. O verde-claro do colégio (`#a3d154`) fica para detalhes e selos.
- **Fontes:** as atuais, Outfit para títulos e DM Sans para texto.
- **Base técnica:** a atual, que já é moderna (Next.js 15, Tailwind 3, componentes Radix/shadcn de `@essencia/ui`, ícones `lucide-react`, `d3-zoom` para o mapa). Animações com Framer Motion, que já é dependência de `@essencia/ui`. Trocar a base traria risco a um fluxo de pagamento em produção sem ganho visível.
- Respeitar "reduzir movimento" do sistema (`prefers-reduced-motion`): sem animações para quem pediu isso.
- Sem modo escuro (decisão de Claude).

## Página por página

### Moldura comum (cabeçalho e rodapé)

- Cabeçalho branco com o logo do colégio maior que hoje e o link "Meus ingressos", que substitui "Consultar pedido".
- **Rodapé de confiança** em três colunas: *Formas de pagamento* (cartão de crédito e Pix, com selos), *Compra segura* ("Pagamento processado pela Stripe. Os dados do seu cartão não passam pelo nosso servidor.") e *Precisa de ajuda?* (Meus ingressos e contato do colégio). Abaixo, uma linha com nome, CNPJ e endereço do colégio.
- **Sem links "Termos" e "Privacidade" no rodapé** (decisão de Claude): essas páginas não existem em nenhum app, e as políticas do sistema são por evento, mostradas na página do evento e no checkout.
- O nome "Colégio Essência Feliz" e os dados institucionais ficam fixos no app (decisão de Claude). A tabela `schools` só tem `name` e `code`, e mudar o painel está fora do escopo.
- **Dados institucionais** (informados pelo Renato):
  - CNPJ 65.481.923/0001-58;
  - endereço: R. Lourdes de Carvalho, 1212 - Segismundo Pereira, Uberlândia - MG, 38408-268;
  - telefone (34) 3292-7388.
- **"Fale com o colégio"** (no rodapé e em "Quem organiza") liga para esse telefone (`tel:`). O texto diz "telefone", não "WhatsApp", porque não foi confirmado que o número tem WhatsApp.
- Corrigir o defeito de layout atual: toda página usa a mesma largura de conteúdo com margem lateral. Nada colado na borda.

### Página inicial (catálogo)

Decisão de Claude, não discutida com o Renato:

- Mesmo visual da página do evento.
- **Com um só evento à venda**, ele aparece em destaque grande (arte inteira, título, data, local, "a partir de R$" e botão), e não como um cartão pequeno sozinho na tela.
- Com dois ou mais, grade de cartões no novo estilo.
- Os estados vazio e de erro ganham o mesmo cuidado visual.

### Página do evento

Conforme o esboço aprovado:

- **Topo** com o fundo feito da própria arte desfocada sob um véu escuro. À esquerda: categoria, título, data por extenso com horário, local com endereço, selos ("Assentos numerados", "Meia-entrada", oferta de grupo quando houver) e "Realização: Colégio Essência Feliz". À direita: **a arte inteira, sem corte** (proporção mantida).
- **Corpo:** "Sobre o espetáculo", depois "Bom saber" em cartões curtos (meia-entrada, lugares numerados, grupos, acessibilidade), depois "Políticas" como lista de títulos que abrem o texto completo, depois "Quem organiza", com o logo e o botão "Fale com o colégio".
- **Caixa de compra fixa** na lateral (no computador): sessão, preços por tipo de ingresso, aviso da oferta de grupo, botão "Escolher assentos" e duas linhas de segurança ("Pagamento seguro · cartão ou Pix" e "Confirmação na hora, com número do pedido").
- **Celular:** arte inteira no topo, título e informações essenciais na primeira tela, e uma barra fixa embaixo com "a partir de R$ 22,50" e "Escolher assentos".
- Com mais de uma sessão, a caixa de compra permite escolher a sessão.

### Escolha de assentos

**O mapa é a peça principal da tela.**

- **Computador:** o mapa ocupa quase toda a área (cerca de 640 px de altura) e o resumo dos lugares fica numa coluna lateral fixa. Acima, uma faixa com miniatura da arte, título, sessão, e as etapas *1 Lugares → 2 Seus dados → 3 Pagamento*.
- **Palco** desenhado no topo do mapa, e entrada e saída quando existirem.
- **Letras das fileiras** nos dois corredores, onde a planta do teatro as coloca (posições de `layout.rotulos`), **e também** nas duas pontas de cada fileira, calculadas a partir do primeiro e do último assento. Fica assim como no esboço aprovado e também como na sinalização real do teatro (decisão de Claude). Rótulos de fileiras sem nenhum assento são ignorados: o mapa do ballet tem um "X" acima da fileira A que é erro de leitura do PDF.
- **Desenho dos assentos: cadeirinhas em contorno do "estilo B"** (decisão do Renato em 2/11/2026, confirmada em 8/11/2026). Cada lugar é um retângulo arredondado com uma faixa mais escura na base, fazendo de encosto, **girado conforme a curva da fileira** (`metadata.rotacao`, que passa a ser enviada pela API pública), parecido com a planta oficial do teatro. Referência: `docs/superpowers/specs/2026-11-02-eventos-gerador-mapa/direcao-visual.png`, opção B.
- **Cores dos assentos** (decisão do Renato em 8/11/2026):
  - *Livre*: branco com contorno;
  - *Seu lugar*: verde-escuro preenchido, com o número em branco;
  - *Ocupado*: cinza;
  - *Acessível*: azul. Vale para as categorias `CADEIRANTE`, `OPCIONAL_CADEIRANTE` e `OBESO`, explicadas em palavras simples ao passar o mouse ou tocar.
- Para quem compra, os estados `reserved`, `sold` e `blocked` viram **um só: Ocupado** (decisão de Claude).
- Legenda curta sobre o mapa. Botões de aproximar, afastar e enquadrar tudo. Ao passar o mouse sobre um lugar, aparece "Fileira G · Assento 18 · Livre · Inteira R$ 45,00".
- **Celular:** a tela abre com o teatro inteiro enquadrado (palco e letras visíveis). A pessoa aproxima com dois dedos, com os botões + e −, ou tocando numa área. Aproximado, os números aparecem dentro dos assentos, as letras ficam presas nas laterais da tela e uma **miniatura** num canto mostra a parte do teatro que está sendo vista.
- **A lista de cartões deixa de ser o modo padrão no celular.** Ela continua existindo como alternativa acessível, pelo link "Prefere uma lista? Ver lugares em lista", operável por teclado e leitor de tela.
- **Resumo dos lugares** (coluna lateral no computador; barra fixa embaixo no celular, que abre uma gaveta ao tocar): cada lugar escolhido com Inteira/Meia-entrada para escolher ali mesmo, como já funciona hoje; o aviso "Escolha mais N lugares e ganhe X% de desconto" com uma barrinha de progresso, usando as ofertas que já existem; o total e o botão **Continuar**.
- O limite de 20 lugares e as mensagens de conflito continuam, no novo visual.

### Lugares guardados por 15 minutos (item 3)

- Ao clicar em **Continuar** no mapa, os lugares são **reservados na hora**, por 15 minutos, o mesmo prazo já usado pela API.
- No checkout, uma faixa fixa no topo mostra "Seus lugares estão guardados por 14:32", contando para trás.
- **Quando o tempo acaba:** os lugares são liberados e a tela mostra "O tempo acabou e os lugares foram liberados", com um botão que volta ao mapa com a mesma escolha marcada, se os lugares ainda estiverem livres.
- **"Alterar lugares"** no checkout volta ao mapa com a escolha marcada. **Ao voltar ao mapa, os lugares da própria pessoa precisam aparecer como dela (selecionados), nunca como "Ocupado".** Liberar a reserva ao voltar ou reconhecer a reserva como da pessoa fica a critério de quem constrói.
- Isso muda a regra da API. Hoje `POST /eventos/public/reservas` exige `buyer` (nome, e-mail, telefone), e esses campos são `NOT NULL` em `evento_pedidos`. Nome, e-mail e telefone passam a ser informados depois, no checkout. Quem constrói decide a forma: migration tornando os campos opcionais até a finalização, ou outra solução equivalente. Hoje a idempotência da reserva compara o e-mail do comprador; isso precisa continuar seguro sem o e-mail.
- Não pode ficar mais fácil segurar o teatro inteiro. Mantêm-se o limite de 20 lugares por pedido e o limite de tentativas (`@Throttle`). Quem constrói avalia se é preciso algo a mais.
- **O limite de tentativas hoje não funciona por pessoa.** A API roda atrás do nginx sem `trustProxy` (`services/api/src/main.ts`), então o `ThrottlerGuard` vê sempre o IP do nginx e soma todo o público num contador só. Com mapa ao vivo e reserva no "Continuar", umas 40 pessoas ao mesmo tempo bastariam para todo mundo receber 429. **Decisão de Claude:** corrigir só no módulo de eventos, identificando o cliente pelo `X-Real-IP` que o nginx envia (aceito só quando vem do nginx). Mudar a configuração geral da API mexeria em login, loja e demais módulos e fica fora deste projeto; o problema geral foi relatado ao Renato à parte. Depois da correção, os limites do mapa (120/min) e das reservas passam a valer por pessoa e devem ser reavaliados com esse número em mente.
- Se o pagamento falhar ou for recusado, a pessoa tenta de novo na mesma tela enquanto a reserva estiver valendo. Se o tempo acabar, ela é levada de volta ao mapa, como descrito acima.

### Mapa ao vivo (item 4)

- Com a pessoa na tela do mapa, o site consulta de novo a disponibilidade a cada 20 segundos, mais ou menos, e pausa quando a aba não está visível. O endpoint público do mapa aceita 120 chamadas por minuto por IP.
- Lugar que outra pessoa pegou fica cinza sem recarregar a página.
- Se um lugar que a pessoa já tinha marcado for pego, ele sai da escolha com o aviso "O lugar G20 acabou de ser escolhido por outra pessoa" (anunciado também ao leitor de tela).

### Acabamento (item 6)

- Animação curta ao marcar ou desmarcar um lugar. Os itens do resumo entram e saem com suavidade e o total muda sem salto.
- Vibração leve ao tocar num lugar, onde o navegador permitir (`navigator.vibrate`). Funciona no Android; o iPhone não permite e ignora sem erro.
- Tudo desligado com "reduzir movimento".

### Checkout

Conforme o esboço aprovado:

- Faixa do relógio no topo e etapas com *Lugares* concluída e *Seus dados* ativa.
- **Seus dados:** nome completo, e-mail e "Celular (WhatsApp)". O texto explicativo é "Usamos para identificar seu pedido e falar com você, se precisar." Nada sobre e-mail de confirmação, que não existe.
- **Quem vai sentar em cada lugar:** um campo por lugar, com a etiqueta do lugar (G21). **Só o nome**, obrigatório, como hoje. Em 8/11/2026 o Renato confirmou isso e substituiu a decisão de 27/10/2026, que pedia nome e turma para aluno e nome, e-mail e celular para convidado. O motivo: pedir mais dados deixa pesada a compra de um grupo de 10. Nos lugares de meia-entrada aparece o lembrete "leve o documento que dá direito ao desconto".
- **Políticas:** **uma única caixa** "Li e aceito as políticas do evento", com os títulos em português ("Cancelamento e reembolso", "Compra e meia-entrada", "Privacidade", "Acessibilidade", "Contato"); cada um abre o texto completo numa janela ou gaveta. Ao marcar a caixa, o envio continua registrando o aceite das 5 políticas com a versão de cada uma, exatamente como `finalizarPedido` faz hoje. Nenhum nome interno aparece na tela (decisão de Claude).
- **Resumo** fixo na lateral (computador) ou recolhido no topo (celular, "3 lugares · G19, G20, G21 ▾ · R$ 112,50"): arte, título, data, local, lugares com tipo e preço, desconto quando houver, total e "Alterar lugares".
- Botão **"Ir para o pagamento"** (com cadeado). Se faltar algo, a tela diz o quê, em vez de só deixar o botão cinza.

### Pagamento dentro do site (etapa 3)

- O botão leva à etapa *3 Pagamento* **no próprio site**, com o **formulário embutido da Stripe**: cartão ou Pix. Quem constrói escolhe entre o Embedded Checkout e o Payment Element; a documentação da Stripe confirma o Pix nos dois, em BRL. A pessoa nunca é levada para uma página da Stripe.
- O relógio dos lugares guardados e o resumo do pedido continuam visíveis durante o pagamento.
- No Pix, o QR code e o "copia e cola" aparecem dentro do site, e a tela espera a confirmação.
- Uma linha de confiança junto do formulário: "Pagamento processado pela Stripe. Os dados do seu cartão não passam pelo nosso servidor."
- Confirmado o pagamento, a pessoa vai direto para a confirmação, que é o ingresso.
- A confirmação do pedido continua vindo do webhook assinado da Stripe, como hoje. A tela não dá o pagamento como confirmado só porque o navegador disse que deu certo.

### Confirmação = ingresso

- Depois de pagar, enquanto o webhook confirma o pagamento, a tela mostra "Confirmando seu pagamento…", mantendo a consulta repetida que já existe. Confirmado, aparecem "Pagamento confirmado", o número do pedido e o nome do comprador.
- **Cada lugar comprado é um ingresso individual** (decisão do Renato). Isso já é verdade no banco: um registro em `evento_ingressos` por item do pedido.
- **Um cartão por lugar**, que no celular se navega deslizando para o lado ("Ingresso 1 de 3"). Cada cartão traz: faixa com miniatura da arte, título, data, hora e local; fileira, assento e tipo (Inteira/Meia) em destaque; **QR code** com o `qr_payload` que o sistema já gera; **número do ingresso**; nome do participante. Abaixo: "Na entrada, mostre o QR code ou informe o número."
- **Os dois meios de conferência são decisão do Renato:** quem confere na porta pode ler o QR ou digitar o número.
- **Número do ingresso** (decisão de Claude quanto ao formato): 8 caracteres, mostrados como `XXXX-XXXX`, sem caracteres que se confundem (sem 0/O, 1/I/L), único. Hoje o ingresso não tem esse número, então ele vira um **campo novo em `evento_ingressos`** (migration), gerado quando o ingresso é emitido. Ingressos emitidos antes da mudança, se houver (pedidos de teste), recebem número por backfill.
- O QR code é gerado dentro do próprio sistema (no servidor ou no navegador), **nunca por serviço externo**, porque o conteúdo do QR é a credencial de entrada.
- **Cada ingresso pode ser compartilhado sozinho, em PDF, pelo WhatsApp** (decisão do Renato). Quem compra para várias famílias manda a cada uma só os ingressos dela.
  - Cada cartão tem o botão **"Compartilhar"**. Ele gera um PDF só daquele ingresso (arte, evento, data, hora, local, fileira, assento, tipo, participante, QR code e número) e abre a tela de compartilhamento do celular (Web Share API com arquivo), de onde a pessoa escolhe o WhatsApp.
  - Onde o navegador não compartilha arquivos (a maioria dos computadores), o mesmo botão baixa o PDF.
  - Também há **"Baixar todos"**, que gera um PDF com todos os ingressos do pedido, um por página (decisão de Claude).
  - O PDF é gerado dentro do sistema, sem serviço externo. Quem constrói escolhe se é no servidor ou no navegador.
  - Quem tem o PDF tem o ingresso, e é essa a intenção. Barrar o uso repetido do mesmo QR ou número é papel do projeto de conferência na porta.
- A folha de estilo de impressão continua existindo para quem quiser imprimir direto do navegador.
- **Acesso protegido:** QR code e número do ingresso só aparecem para quem abre a página pelo link seguro gerado na compra (para onde a pessoa vai ao terminar o pagamento) ou por "Meus ingressos" com dois dados da compra (ver abaixo). O link seguro vale até 30 dias depois da última sessão do evento (decisão de Claude), porque faz papel de ingresso. Hoje `GET /eventos/public/pedidos/:orderNumber` responde só com o número do pedido. Esse acesso não pode passar a expor ingressos. Existe a tabela `evento_tokens_consulta` (pedido, e-mail, hash do token, validade), criada e ainda sem uso, que pode servir de base. O mecanismo fica a critério de quem constrói.

### Meus ingressos (antiga "Consultar pedido")

- Tela simples no novo visual, botão "Ver meus ingressos".
- Duas formas de entrar:
  - **número do pedido + e-mail da compra**;
  - **e-mail + celular usados na compra** (decisão do Renato), para quem perdeu o link e não anotou o número do pedido, que tem 12 caracteres e só aparece na confirmação.
- Com e-mail + celular, aparecem todos os pedidos pagos daquela combinação. Celular comparado só pelos dígitos.
- Leva à mesma página de ingressos acima.
- Erros em linguagem simples ("Não encontramos um pedido com esses dados"), sem revelar se o e-mail existe.
- Limite de tentativas por pessoa, para impedir que alguém fique chutando combinações.
- Como não há e-mail, esta é a forma de recuperar os ingressos se a pessoa perder o link.

### Estados

Carregando (esqueletos no lugar de telas em branco), erro (mensagem e "tentar de novo") e evento ou sessão não encontrados ou sem venda, todos no novo visual. A mensagem atual "Não há ingressos disponíveis para esta sessão" deixa de ser um aviso vermelho solto.

## Mudanças na API (resumo para planejar)

1. **Mapa público envia o desenho do teatro.** `GET /eventos/public/sessoes/:sessionId/map` passa a incluir, do `evento_mapas.layout`, as posições das letras das fileiras (`rotulos`), o palco, a entrada e a saída (`elementos`) e o tamanho da página. Também pode incluir a rotação de cada assento, que está em `metadata.rotacao`. O tipo `PublicMap` em `packages/shared` cresce de acordo. A proposta de mapa grava `x`/`y` do lugar como centro e o mapa publicado grava o canto superior esquerdo (`proposta-para-confirmacao.ts`); quem constrói confere se rótulos e elementos estão no mesmo sistema de coordenadas dos assentos.
   - **Mapa sem `layout`** (mapas confirmados antes de o campo existir): letras inferidas das pontas de cada fileira; palco omitido, sem chute de posição.
2. **Reserva sem dados do comprador** e dados do comprador enviados na finalização (seção "Lugares guardados").
3. **Ingressos no pedido:** número curto novo em `evento_ingressos` e endpoint protegido que devolve os ingressos (QR e número) por link seguro, por número do pedido + e-mail ou por e-mail + celular. Se o PDF for gerado no servidor, também um endpoint protegido que entrega o PDF de um ingresso ou de todos.
5. **Limite de tentativas por pessoa** no módulo de eventos (seção "Lugares guardados").
6. **Pagamento embutido:** a criação da sessão de pagamento dos eventos passa a usar o modo embutido da Stripe (por exemplo, `ui_mode: "embedded"` com `return_url`, devolvendo o `client_secret` em vez da URL de redirecionamento). O `PaymentsService` é compartilhado com a loja: o modo embutido entra como opção, e o comportamento padrão continua o atual. A loja não pode mudar nada, e os testes da loja precisam continuar passando.
7. **Política de segurança (CSP) de `eventos.portalcef.com.br` no `nginx.conf`:** hoje ela só registra avisos (`Report-Only`) e não lista a Stripe. Incluir os domínios que o formulário embutido usa (`js.stripe.com` em scripts e frames, e as chamadas e frames de `*.stripe.com`). Incluir também a origem das imagens dos eventos (`www.portalcef.com.br/storage`). Assim os avisos param e a política fica pronta para ser aplicada de verdade.
4. Migrations: tornar opcionais os campos do comprador até a finalização (ou equivalente) e criar o número do ingresso. O deploy usa `./scripts/deploy.sh --migrar`.

## Restrições do projeto

- Regras do `CLAUDE.md`: tudo em português do Brasil; apps falam com o banco só pela API; `pnpm turbo lint && pnpm turbo typecheck` antes de commit; TDD obrigatório (teste primeiro, vendo falhar).
- Os testes existentes do app (`app/publico.test.tsx`, `app/sessao-page.test.tsx`, `app/checkout-page.test.tsx`, `lib/eventos-api.test.ts`) e o smoke `apps/eventos/scripts/smoke-publico.mjs` precisam ser atualizados para o novo fluxo, sem perder a cobertura dos comportamentos listados em "O que não pode acontecer".
- O mapa precisa continuar fluido com 752 lugares no celular. Quem constrói escolhe a técnica (SVG com `d3-zoom` como hoje, canvas etc.).

## Estado do ballet em produção (conferido em 2026-11-08, consulta só de leitura autorizada pelo Renato)

- Mapa em uso: versão 5, `CONFIRMADO`; a versão 4 está `ARQUIVADO`.
- O `layout` existe: página de 8420 × 5950; 38 rótulos de fileira, dois por fileira (nos corredores, em x ≈ 2530 e x ≈ 4850), mais um "X" sem assentos que deve ser ignorado; 4 elementos: PALCO (3690, 299), ENTRADA (3682, 5613) e duas SAÍDAS (895, 604 e 6488, 604).
- **Nenhum pedido, reserva, pagamento ou ingresso** no evento. Os 752 lugares estão `DISPONIVEL`. A trava `VENDA_CONFIRMADA` não está ativa e não há limpeza a fazer.

## Antes de divulgar (verificações)

1. **O Pix está ativo na conta Stripe.** O código pede, mas a conta precisa estar habilitada. Se não estiver, todos os textos que dizem "cartão ou Pix" passam a dizer só "cartão".
2. **Compra de ponta a ponta, no celular e no computador:** escolher lugares, ver o relógio, pagar, ver os ingressos, compartilhar um PDF e recuperar por "Meus ingressos". **Nunca no evento do ballet** (decisão de Claude). Um único ingresso emitido, mesmo de teste ou reembolsado, ativa a trava `VENDA_CONFIRMADA` e impede para sempre qualquer mudança no mapa (`services/api/src/modules/eventos/mapas/trava-venda.ts`). O teste usa um evento de teste separado.

## Conteúdo que o Renato corrige no painel (não é código)

- O contato do evento é `renato@famanegociosimobiliarios.com.br`, e-mail de uma imobiliária numa página de ballet escolar. Trocar pelo contato oficial do colégio.
- A descrição promete "pacote promocional de 10 ingressos inteiros por R$ 380,00", mas o sistema aplica 15% sobre R$ 450,00, o que dá **R$ 382,50**. Alinhar o texto ou a oferta.

## O que fica para quem constrói

- Organização dos componentes, técnica de desenho e zoom do mapa, bibliotecas de QR code e PDF (sem serviço externo), onde gerar o PDF, mecanismo do link seguro e da liberação de reserva, forma da migration dos campos do comprador e ordem das tarefas.
- Detalhes visuais finos (espaçamentos, sombras, raios, tamanhos exatos) dentro da direção dos esboços.
