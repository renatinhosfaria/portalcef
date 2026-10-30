# Workspace híbrido para criação e publicação de eventos

## Intenção

Transformar o cadastro de eventos do Portal CEF em um workspace administrativo inspirado no fluxo operacional da Sympla: o usuário cria um rascunho assim que informa o título, continua o trabalho em etapas independentes, não perde progresso e publica somente quando todas as condições operacionais estiverem atendidas. A identidade visual permanece própria do Portal CEF.

O fluxo atende Diretor, Gerente de Unidade e Auxiliar Administrativo no módulo de eventos. Ele deve funcionar tanto para quem cria o primeiro evento quanto para quem retorna a um rascunho parcialmente configurado.

## Objetivos

- Criar o evento após o primeiro título válido e gerar o slug automaticamente.
- Salvar alterações continuamente, com indicação clara do estado do salvamento.
- Organizar o trabalho em etapas acessíveis por navegação lateral.
- Mostrar progresso e pendências no cabeçalho do evento e em um checklist de publicação.
- Permitir trabalhar em qualquer etapa sem obrigar uma sequência linear.
- Bloquear publicação com explicações acionáveis quando mapa, sessões, inventário, ingressos, políticas ou textos obrigatórios estiverem incompletos.
- Preservar as regras atuais de tenant, auditoria, revisão humana de mapa e inventário por sessão.

## Fora de escopo

- Reproduzir identidade visual, textos, marca ou código da Sympla.
- Marketplace para várias escolas ou organizadores.
- Marketing, cupons, produtos adicionais, certificados ou novos meios de pagamento.
- Aplicativo mobile ou modo offline para o painel.
- Alteração de um evento ou sessão que já tenha vendas; a regra atual exige nova versão nesses casos.
- Publicação automática baseada apenas em uma data planejada; o agendamento automático será tratado quando houver um mecanismo de scheduler definido. O campo de data pode continuar sendo editável e visível como planejamento.

## Antiobjetivos

O fluxo falha se perder alterações, exigir que o operador refaça etapas já concluídas, publicar uma página sem inventário vendável ou esconder por que uma publicação está bloqueada.

## Abordagens consideradas

1. **Wizard linear:** orienta iniciantes, mas conflita com mapa, sessões e políticas que são trabalhados em momentos diferentes.
2. **Página única com blocos expansíveis:** dá visão geral, mas cresce demais e mistura revisão de mapa e configuração comercial.
3. **Workspace híbrido (escolhido):** mantém etapas independentes com status, autosave e checklist final. É o melhor ajuste ao domínio existente, que já possui rotas e serviços separados para evento, mapa, sessões, inventário e políticas.

## Experiência proposta

### Entrada e criação do rascunho

A rota de novo evento mostra inicialmente apenas o campo de título e uma ação de continuação. Depois que o título passa a ser válido, o cliente cria o rascunho imediatamente com a escola derivada da sessão/tenant. A API normaliza o título para gerar um slug único por escola. O usuário poderá editar o slug na etapa de informações básicas; depois de uma edição manual, mudanças no título apenas sugerem um novo slug. Depois que o evento for publicado, o slug fica imutável para preservar a URL pública.

Depois da criação, a URL passa a conter o identificador do evento e abre o workspace. O rascunho já existe mesmo que todas as outras etapas estejam vazias.

### Cabeçalho do workspace

O cabeçalho exibe título, status (`RASCUNHO`, `PUBLICADO`, `PAUSADO` ou `CANCELADO`), indicador de salvamento (`Salvando…`, `Salvo agora`, `Não foi possível salvar`) e ações compatíveis com o estado. Enquanto o evento não estiver publicado, há uma ação principal para abrir a revisão e publicar.

### Navegação lateral

As etapas são persistentes e podem ser abertas em qualquer ordem:

1. **Informações** — título, slug, resumo, descrição, imagem, categoria, contato e política de cancelamento.
2. **Sessões e local** — horários, capacidade, janela de vendas e local herdado ou específico.
3. **Mapa e lugares** — arquivo original, detecção, revisão humana, confirmação do mapa e geração/atualização do inventário.
4. **Ingressos** — tipos, preços, elegibilidade, lotes e limites por pedido.
5. **Políticas** — cinco políticas obrigatórias, versão ativa e histórico de alterações.
6. **Revisar e publicar** — checklist, resumo público, pendências e publicação.

Cada item mostra um estado: não iniciado, em andamento, pronto ou com erro. O estado vem de uma verificação de prontidão no servidor, não apenas de campos preenchidos no navegador.

### Autosave

Alterações em campos persistidos são agrupadas por um debounce curto e enviadas como `PATCH` para o recurso correspondente. O cliente mantém o último valor confirmado, mostra o horário do último salvamento e preserva alterações locais quando a rede falhar. Ao retornar ao workspace, o servidor é a fonte de verdade; conflitos ou falhas de versão devem ser apresentados para decisão, sem sobrescrever silenciosamente o trabalho.

A criação inicial do rascunho é uma operação própria e idempotente. Os salvamentos seguintes devem ser parciais, para evitar que uma alteração em uma etapa regrave dados de outra etapa.

### Checklist de publicação

A revisão consulta um endpoint de prontidão que retorna itens bloqueadores e avisos, com vínculo para a etapa que resolve cada item. A publicação exige, no mínimo:

- textos obrigatórios do evento;
- slug válido e único;
- pelo menos uma sessão com horários, capacidade e janela válidos;
- local efetivo para cada sessão;
- mapa confirmado para o evento ou para cada sessão;
- pelo menos um assento vendável por unidade de capacidade em cada sessão; assentos bloqueados não contam como vendáveis;
- pelo menos um tipo de ingresso com preço válido;
- as cinco políticas ativas;
- ausência de bloqueio de negócio ou estado incompatível.

A revisão também mostra uma prévia resumida da vitrine pública. O botão de publicar chama a rota transacional existente; se a API rejeitar a operação por uma condição concorrente, o checklist é atualizado e o usuário permanece no workspace.

### Estados e continuidade

O mapa pode permanecer em `EM_REVISAO` enquanto outras etapas avançam. A publicação continua bloqueada até que o mapa seja confirmado e o inventário correspondente esteja disponível. Quando o mapa padrão do evento for trocado, as sessões que o herdam passam a referenciar o novo mapa e seus inventários ficam pendentes de revisão/regeneração; sessões com mapa próprio não são alteradas. Depois da publicação, edições que não alteram a configuração vendida podem continuar auditadas; alterações incompatíveis com vendas seguem a regra de nova versão.

## Impacto técnico esperado

- Evoluir `apps/eventos-admin` de telas isoladas para um shell de workspace com navegação lateral, estado de salvamento e checklist.
- Criar uma operação de criação mínima de rascunho e ajustar os contratos atuais, que hoje exigem vários campos no `POST` completo.
- Adicionar endpoints/serviços de prontidão e autosave parcial, mantendo o `POST /eventos/admin/:id/publicar` como autoridade final da publicação.
- Reusar os serviços existentes de mapas, sessões, inventário, ingressos, políticas, tenant e auditoria.
- Manter a regra de que aplicativos acessam o banco somente pela API.

## Decisões de produto confirmadas

- O inventário de uma sessão só satisfaz a publicação quando há pelo menos um assento vendável (`DISPONIVEL` ou `LIBERADO`) por unidade de capacidade; assentos bloqueados não contam.
- O slug gerado automaticamente pode ser editado; após edição manual, mudanças no título apenas geram sugestão, e o slug fica imutável depois da publicação.
- A troca do mapa padrão propaga-se para sessões que herdaram o mapa, invalida o inventário afetado e exige revisão/regeneração antes da publicação. Sessões com mapa específico permanecem intactas.

## Decisões deixadas ao plano de implementação

O plano deverá definir o intervalo exato do debounce, o mecanismo de controle de versão para conflitos, o formato do endpoint de prontidão, a estratégia de geração de inventário ao confirmar um mapa e a forma de representar estados e mensagens no componente visual, sem alterar a experiência aprovada acima.
