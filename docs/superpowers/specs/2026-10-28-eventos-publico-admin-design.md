# Design: aplicações pública e administrativa de Eventos

**Data:** 2026-10-28  
**Status:** Aguardando aprovação para implementação

## Intenção

O módulo de Eventos terá a mesma separação de produto já usada pela loja:

- `eventos-admin`: painel autenticado para a equipe da escola;
- `eventos`: vitrine pública em `https://eventos.portalcef.com.br`, sem exigir login.

A família deverá conseguir abrir o catálogo, consultar um evento publicado,
ver as sessões e a disponibilidade dos lugares e iniciar a inscrição/compra
sem passar pelo Portal CEF administrativo. A administração continuará no
domínio principal, protegida por sessão e pelas roles do módulo.

## Contexto atual

Hoje `apps/eventos` é o painel administrativo, usa `basePath: "/eventos"` e
consulta rotas administrativas. O Nginx publica esse app em
`www.portalcef.com.br/eventos`; o subdomínio `eventos.portalcef.com.br` ainda
não possui um `server` próprio e o certificado atual não contém esse nome.

A API já possui consultas públicas para eventos publicados, detalhes, sessões
e mapas (`/api/eventos/public/*`). O modelo de dados de eventos, sessões,
inventário, pedidos e ingressos já está no banco. A implementação pública de
reserva, checkout e inscrição do modelo multi-evento será exposta por rotas
públicas da API; as rotas administrativas continuarão exigindo autenticação.

## Objetivos

1. Renomear o app administrativo atual para `apps/eventos-admin`, com imagem,
   pacote, serviço e porta próprios.
2. Criar `apps/eventos` como app Next.js público, sem `TenantProvider` nem
   `Shell` administrativo.
3. Publicar `eventos.portalcef.com.br` com TLS válido e proxy exclusivo para o
   app público.
4. Manter o acesso administrativo em `www.portalcef.com.br/eventos-admin`.
5. Preservar compatibilidade com links antigos para `/eventos`, redirecionando
   para `/eventos-admin` sem expor o painel a visitantes externos.
6. Cobrir catálogo, detalhe do evento, seleção de sessão/lugares e o início do
   fluxo de inscrição/checkout como convidado.

## Fora de escopo desta mudança

- Conta obrigatória para compradores externos.
- Compartilhar componentes de autenticação entre a vitrine e o painel.
- Expor qualquer rota administrativa no subdomínio público.
- Reaproveitar a landing legada `mae-por-inteiro` como catálogo geral.
- Alterar as regras comerciais já aprovadas (Stripe, reserva temporária,
  participantes e QR Code); elas serão consumidas pelas rotas próprias da API.

## Abordagens consideradas

### Aplicações separadas — escolhida

O painel atual será movido para `eventos-admin` e uma nova aplicação `eventos`
será criada para a vitrine. O Nginx terá um upstream e um bloco de host para
cada superfície. Essa é a abordagem escolhida por Renato, seguindo o padrão
`loja-admin`/`loja`.

Ela cria uma fronteira clara de autenticação, permite layouts e dependências
menores para cada público e evita fazer o `basePath` administrativo funcionar
em dois hosts com comportamentos diferentes.

### Um único app com roteamento por host — descartada

O mesmo container poderia selecionar catálogo ou painel pelo cabeçalho `Host`.
Isso reduziria o número de imagens, mas misturaria a superfície pública com o
`TenantProvider`, o `basePath` atual e as rotas administrativas, tornando
assets, redirecionamentos e testes mais frágeis.

### Subdomínio apontando para a landing legada — descartada

Seria uma alteração rápida de Nginx e certificado, mas atenderia somente
`Mãe por Inteiro` e não suportaria o catálogo multi-evento nem o fluxo de
compra do novo modelo.

## Estrutura dos apps

### `apps/eventos-admin`

- Origem: código administrativo atualmente em `apps/eventos`.
- Pacote: `@essencia/eventos-admin`.
- Porta interna: `3016`.
- `basePath`: `/eventos-admin`.
- Layout: `TenantProvider` + `Shell`/navegação administrativa.
- APIs: proxy para `/api/eventos/admin/*` e rotas administrativas de mapas,
  sessões, inventário, pedidos e check-in.
- Acesso: `master`, `diretora_geral`, `gerente_unidade` e
  `auxiliar_administrativo`, com a validação definitiva na API.

### `apps/eventos`

- Novo pacote público: `@essencia/eventos`.
- Porta interna: `3014`.
- Sem `basePath`, para que a raiz do host seja a vitrine.
- Layout próprio, responsivo e sem chamada obrigatória a `/api/auth/me`.
- Rotas públicas previstas:
  - `/` — catálogo de eventos publicados;
  - `/evento/[slug]` — detalhe, política, local e sessões;
  - `/evento/[slug]/sessao/[sessionId]` — mapa e seleção de assentos;
  - `/checkout` — dados do comprador e participantes, como convidado;
  - `/pedido/[orderNumber]` — retorno e consulta segura do pedido.
- As páginas usam somente API HTTP por handlers/proxy do app; não acessam
  PostgreSQL, Redis ou MinIO diretamente.

## API pública

As consultas existentes permanecem públicas e serão consumidas pelo app:

| Método | Rota | Uso |
|---|---|---|
| GET | `/api/eventos/public` | Catálogo |
| GET | `/api/eventos/public/:slug` | Detalhe |
| GET | `/api/eventos/public/:slug/sessoes` | Sessões e disponibilidade |
| GET | `/api/eventos/public/sessoes/:sessionId/map` | Mapa estruturado |

O fluxo de inscrição/compra do modelo multi-evento deverá usar endpoints
públicos próprios, com `@Public()`, rate limit e idempotência. O contrato deve
abranger, no mínimo:

- criação de reserva temporária de assentos;
- criação do pedido como convidado;
- criação do checkout hospedado do Stripe;
- consulta do pedido por código/token seguro;
- liberação da reserva por expiração ou falha.

Essas rotas não aceitarão `schoolId`, status, preço ou disponibilidade vindos
do navegador como fonte de verdade; a API recalculará o evento, a sessão, os
assentos e os valores dentro de transação.

## Roteamento e TLS

### Nginx

- `eventos.portalcef.com.br` em HTTP: servir o desafio ACME e redirecionar
  todo o restante para HTTPS.
- `eventos.portalcef.com.br` em HTTPS: usar o certificado que contenha o
  SAN `eventos.portalcef.com.br` e encaminhar `/` para
  `essencia-eventos:3014`.
- Encaminhar `/_next/static/*` e demais arquivos públicos para o mesmo app,
  sem cair no upstream `home`.
- `www.portalcef.com.br/eventos-admin/*`: encaminhar para
  `essencia-eventos-admin:3016`.
- `/eventos` e `/eventos/*` no domínio principal: redirecionar para
  `/eventos-admin` para preservar bookmarks sem manter duas cópias do painel.

### Certificado

Antes do `up` final, o certificado Let's Encrypt será expandido ou recriado
com `eventos.portalcef.com.br` além dos nomes já usados
(`portalcef.com.br`, `www.portalcef.com.br` e `loja.portalcef.com.br`).
O caminho real do certificado será confirmado no volume
`essencia-nginx-certs`; o Nginx será recarregado depois da emissão para não
continuar apresentando o certificado antigo.

O DNS A de `eventos.portalcef.com.br` já aponta para o servidor. A emissão
depende de a porta 80 continuar alcançável para o desafio HTTP-01.

## Build e produção

- Adicionar `eventos-admin` ao `docker-bake.hcl` como target Next.js com
  `APP_NAME=eventos-admin`, `PACKAGE_NAME=@essencia/eventos-admin` e
  `APP_PORT=3016`.
- Manter `eventos` como target público na porta `3014`.
- Adicionar o serviço `eventos-admin` ao `docker-compose.prod.yml` e atualizar
  o serviço `eventos` para a nova aplicação pública.
- Atualizar health checks internos para `/` no público e `/eventos-admin` no
  administrativo.
- Incluir `eventos.portalcef.com.br` no `scripts/health-check.sh`.
- O deploy continuará usando `./scripts/deploy.sh`, com árvore limpa, lint,
  typecheck, testes, Buildx Bake, Compose e health check completo.

## Compatibilidade e migração

1. Copiar/mover o código atual para `apps/eventos-admin` sem perder o histórico
   de rotas administrativas.
2. Atualizar imports, package names, `pnpm-workspace`, lockfile, targets de
   build, Compose, Nginx e links da sidebar/home para `/eventos-admin`.
3. Manter redirects de `/eventos` no domínio principal durante a transição.
4. Criar o app público em paralelo; nenhuma sessão administrativa será lida
   pelo layout público.
5. Só trocar o certificado e publicar o host público depois que `nginx -t`, o
   app público e o health check interno estiverem aprovados.

## Testes e critérios de aceite

- O app `eventos-admin` passa lint, typecheck e testes existentes do módulo.
- O app `eventos` passa lint, typecheck e testes de catálogo, detalhe e estado
  não autenticado.
- Usuário sem cookie acessa `https://eventos.portalcef.com.br/` e recebe
  `200` com o catálogo, sem redirecionamento para `/login`.
- Usuário sem cookie consegue abrir um evento publicado e consultar sessões e
  mapa público; dados de assentos não publicados não aparecem.
- O fluxo de inscrição/checkout não exige conta e não confia em preço,
  disponibilidade ou tenant enviados pelo cliente.
- Usuário sem sessão que abre
  `https://www.portalcef.com.br/eventos-admin` é levado ao login; nenhum
  painel ou dado administrativo é renderizado.
- `https://www.portalcef.com.br/eventos` redireciona para
  `/eventos-admin`.
- O certificado apresentado para `eventos.portalcef.com.br` valida sem
  `-k` e inclui o nome no SAN.
- O health check interno e externo passa para ambos os apps, API, PostgreSQL,
  Redis e MinIO.

## Decisões adotadas para o plano

- A consulta do pedido usará somente o número do pedido. Para reduzir a
  enumeração, esse número deverá ser aleatório, não sequencial, com rate limit
  e resposta mínima; dados pessoais e ações administrativas nunca serão
  liberados apenas com essa consulta pública.
- O primeiro formulário público atenderá somente a compra de ingressos do
  modelo multi-evento. A inscrição legada de `mae-por-inteiro` continuará no
  fluxo legado até uma migração explícita, sem misturar contratos no novo app.
- Os textos de privacidade, compra, cancelamento/reembolso, acessibilidade e
  contato virão das políticas versionadas pela API e administradas no painel;
  o checkout registrará a versão aceita junto ao pedido.
