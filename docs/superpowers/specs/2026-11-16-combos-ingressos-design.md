# Combos de ingressos com quantidade configurável

**Status:** especificação revisada aprovada por Renato em 16/11/2026; preparação do plano de implementação autorizada.

## Intenção e decisões confirmadas

Permitir vender um pacote de lugares por um preço único, mantendo a escolha de assentos antes da composição da compra. Renato criou “Combo 10 ingressos” e confirmou:

- A quantidade de lugares por ingresso será configurável no cadastro.
- O preço cadastrado representa o pacote completo.
- O comprador escolhe usar combos; a aplicação não é obrigatória.
- Dez assentos permitem um combo; onze permitem um combo mais um avulso; vinte permitem dois combos.
- Cada assento gera um ingresso individual com seu próprio QR Code.
- Não haverá limite global de assentos por pedido; Renato solicitou remover o teto atual de 20.

## Abordagens consideradas

1. Combo fixo de dez: menor flexibilidade, exige alteração de código para outros tamanhos.
2. Quantidade configurável por tipo de ingresso: exige propagar a configuração pelo cadastro, contrato público e cálculo, mas atende outros tamanhos sem código novo. **Escolhida por Renato.**

## Comportamento proposto

As decisões da primeira seção foram confirmadas por Renato. Os detalhes operacionais desta seção e as propostas indicadas adiante foram apresentados como escolhas do agente e integram o desenho revisado aprovado.

O cadastro terá “Lugares por pacote”, inteiro positivo, com padrão 1. Quantidade 1 mantém a venda avulsa. Para este ingresso existente, será necessário configurar 10 explicitamente; o nome não determina comportamento.

Depois da seleção de assentos, o comprador poderá escolher quantos pacotes completos deseja de cada tipo disponível. Só será possível adicionar um pacote quando houver lugares suficientes ainda fora de outros pacotes. Os lugares restantes exigem a escolha de um tipo avulso; permanece a seleção automática quando existe apenas um tipo avulso elegível.

Proposta do agente: vincular os lugares aos pacotes em ordem determinística da seleção, mostrar quais lugares cada pacote cobre e permitir desfazer um pacote. Isso evita obrigar o comprador a repetir a escolha do combo em dez linhas. Lugares classificados como avulsos também podem ser convertidos em pacote por ação explícita do comprador; a seleção automática de um tipo avulso não deve impedir a escolha de combo. Priorizar lugares sem classificação e depois avulsos, mantendo a ordem da seleção em cada conjunto. Nunca reutilizar lugares pertencentes a outro pacote.

Se um lugar de um pacote for removido, desfazer somente esse pacote inteiro e deixar seus lugares restantes sem classificação. Desfazer manualmente um pacote tem o mesmo efeito. Preservar os outros pacotes e avulsos. Nesses dois casos, exigir nova escolha explícita, mesmo que só exista um tipo avulso, para não substituir o combo automaticamente por outra cobrança. A seleção automática de tipo avulso vale apenas para lugares novos, antes de terem integrado um pacote.

Combos não aparecem como tipos avulsos na escolha de cada lugar e nunca são selecionados automaticamente, mesmo quando constituem o único tipo disponível. Se a sessão só tiver combos, quantidades que não possam ser cobertas por pacotes completos impedem continuar, com explicação do que falta. Todo lugar deve estar vinculado a exatamente um pacote completo ou um tipo avulso antes da reserva.

O resumo apresenta quantidades de pacotes, lugares cobertos, avulsos e total. A escolha persiste ao avançar para o checkout e retornar.

Mostrar o preço de um combo sempre acompanhado de sua quantidade de lugares e da indicação de preço do pacote. Não apresentar o preço rateado como valor de um ingresso avulso à venda. Preservar a regra existente do preço principal de inteira nas páginas públicas; combos não devem ser confundidos com inteira por conter essa palavra no nome. Na ausência de inteira avulsa, os pacotes continuam identificados como pacotes na listagem de tipos.

## Preço, validação e emissão

- O servidor valida tipos ativos, vínculo com evento e sessão, disponibilidade dos assentos, exclusividade de cada lugar e grupos completos para cada tamanho configurado.
- Recalcula o preço a partir do cadastro; não aceita preço fornecido pelo navegador.
- Cada pacote custa exatamente o preço cadastrado. Para manter um item por assento, distribuir o valor em centavos entre seus lugares, com distribuição determinística do resto; a soma precisa ser exata.
- Rateio proposto: para preço P em centavos e N lugares, cada item recebe o quociente inteiro de P/N, e os primeiros P módulo N lugares recebem mais um centavo. Ordenar por identificador do assento para que o resultado não mude se a requisição vier em outra ordem. Aplicar separadamente a cada pacote, inclusive quando houver vários do mesmo tipo. Por exemplo, R$ 100,01 em três lugares resulta em R$ 33,34, R$ 33,34 e R$ 33,33.
- Guardar a identificação do pacote e a evidência de quantidade, preço total, versão do tipo e valor base rateado nos itens do pedido. Cada item continua com quantidade 1. Pedidos existentes permanecem com seus valores originais; alterações posteriores no cadastro não recalculam pedidos já reservados.
- Preservar as regras atuais de cupons, sem criar desconto automático adicional para combos. O cupom usa os valores dos itens já rateados como base.
- Aplicar, trocar ou remover cupom deve preservar os grupos e seus valores base, sem reconstruí-los a partir do preço atual do cadastro e sem perder a evidência do pacote. O valor exato do pacote corresponde ao subtotal antes do cupom; o total após cupom pode ser menor. Manter o valor mínimo de pagamento já existente, sem criar um mínimo por assento: o rateio pode produzir itens de valor zero.
- Manter reserva, identificação de participantes, emissão e entrada por assento: dez lugares significam dez ingressos, dez QR Codes e dez entradas independentes.
- Preservar proteção contra reservas concorrentes, idempotência e validações de checkout. Grupo incompleto vindo de URL ou requisição manipulada não pode ser reservado.
- A comparação de idempotência inclui sessão, assentos, tipos, participantes e composição dos pacotes. Identificadores transitórios dos grupos não podem causar conflito quando os mesmos lugares formam os mesmos pacotes; mudar efetivamente a composição com a mesma chave deve gerar conflito. Repetir uma reserva compatível devolve o pedido existente e seus preços registrados.

## Persistência, retorno e alterações de disponibilidade

O estado da seleção precisa incluir o vínculo dos assentos com cada pacote, e não apenas o tipo de ingresso por lugar. A ida ao checkout, o retorno ao mapa e a recuperação após erro devem preservar essa composição. URLs antigas de ingressos avulsos continuam funcionando; não inferir um pacote apenas porque vários lugares trazem o mesmo tipo.

Remover o teto de assentos exige evitar transportar a lista completa de lugares, tipos e grupos exclusivamente na URL: seu tamanho pode impedir compras maiores. O plano deve definir uma forma de persistência compatível com o fluxo existente, sem dados pessoais na URL e sem substituir o limite removido por truncamento da seleção. Após uma reserva criada, o pedido e suas evidências são a fonte de verdade para o checkout.

Ao detectar um lugar indisponível, não substituir por outro assento nem remanejar grupos automaticamente. Preservar a seleção recuperável e informar a necessidade de revisão. A retirada do lugar conflitante segue a mesma regra de desfazer apenas seu pacote, quando houver. Nenhum pedido pode avançar com grupo incompleto ou reserva vencida; manter o fluxo atual de liberação e expiração.

## Limites e compatibilidade

Remover o limite global de **20 assentos por pedido** de todas as etapas, incluindo seleção, validação da reserva e cadastro de participantes. Não substituir esse teto por outro número fixo. A quantidade depende da disponibilidade física e das regras explicitamente configuradas para cada tipo. Vinte e um assentos permitem dois combos de dez mais um avulso; trinta permitem três combos. O tamanho configurável do pacote é um inteiro positivo, sem teto de 20.

Pontos confirmados no código: constante `LIMITE_LUGARES` e aviso na escolha de lugares, além de `.max(20)` nos schemas de reserva e finalização. O plano deve verificar também restauração da seleção e testes que cristalizem esse teto. A remoção não altera outras regras de capacidade, autorização ou mínimo de pagamento.

Proposta do agente: preservar o significado atual do limite por tipo no pedido como quantidade de lugares, com texto explícito no cadastro. Um combo de dez usa dez unidades desse limite; com limite 20 são permitidos dois combos. A disponibilidade física continua sendo contada por assento.

Esse limite por tipo é opcional e distinto do teto global removido: sem valor configurado, não há limite por tipo. Não criar valores automáticos na migration. Se houver limite inferior ao tamanho de um pacote, o cadastro deve sinalizar que nenhum pacote desse tipo poderá ser comprado, e a API deve rejeitar a tentativa de reserva.

Tipos existentes recebem quantidade 1. Não inferir combos por nome, nem alterar automaticamente ingressos existentes ou pedidos históricos. A mudança precisa de migration compatível. Aplicações continuam acessando dados exclusivamente pela API e mantendo o contexto de autorização existente.

A validação da quantidade deve existir em todas as entradas administrativas que criam ou atualizam tipos, e no banco, além do formulário. Configurações inválidas não podem chegar à compra pública. Tipos internos de cortesia permanecem fora da venda pública e continuam emitidos pelo fluxo atual.

Ficam fora desta entrega: combos entre sessões, pacotes incompletos, desconto automático por quantidade e novo fluxo de cancelamento ou reembolso.

## Partes afetadas e liberdade de implementação

Cadastro administrativo de ingressos, schema e migration do banco, validações e contratos compartilhados, resumo da seleção, persistência da seleção no checkout, reserva pública, cálculo de preços e evidências do pedido. A emissão deve reaproveitar o fluxo individual existente.

Incluir os contratos de consulta do pedido e o resumo do checkout para reconstruir pacotes a partir das evidências persistidas; preservar essa informação ao atualizar itens por cupom. Na emissão e no check-in, verificar que a identificação do combo não agrupa permissões de entrada: ler um QR Code não deve consumir os demais.

Nomes técnicos dos campos, representação dos grupos na requisição e organização interna dos componentes ficam para o plano de implementação. Preferir evoluir os contratos existentes e centralizar a regra de cálculo compartilhada entre navegador e API, mantendo o servidor como autoridade.

## Critérios de aceitação e verificação

Cobrir com testes: nove lugares sem combo de dez; dez com um combo; onze com um combo e um avulso; vinte com dois combos; vinte com um combo e dez avulsos; vinte e um com dois combos e um avulso; trinta com três combos; tamanho diferente de dez, inclusive acima de vinte; remoção de lugar; desfazer pacote; recuperação no checkout; rejeição de pacote incompleto e de assento duplicado; rateio com resto de centavos; cupom; limite por tipo quando configurado; seleção, reserva e finalização com mais de vinte participantes; compatibilidade de ingressos avulsos; reserva idempotente; emissão de um QR Code por assento e entrada independente.

Acrescentar cenários de regressão para:

- Conversão de avulsos previamente selecionados em combo; sessão com um avulso mais um combo; sessão só com combos; múltiplos tamanhos no mesmo pedido sem sobreposição de lugares.
- Desfazer apenas o pacote afetado, sem cobrança automática de avulsos e sem perder os demais grupos.
- Rateio idêntico com entrada reordenada, rateio separado por pacote e cupom aplicado, trocado e removido sem perder a composição nem duplicar descontos.
- Mudança de preço ou tamanho no cadastro depois de reservar: manter o pedido e seu rateio histórico; nova reserva usa a configuração atual.
- Reserva repetida compatível e conflito por composição diferente; falha concorrente sem gravar um pacote parcial.
- Persistência e retorno de seleção grande sem depender de URL proporcional ao número de lugares, sem truncamento e com todos os participantes associados aos itens corretos.
- Quantidade inválida rejeitada pelo cadastro/API/banco; migration com padrão 1 e pedidos históricos preservados; preço público identificado como pacote; emissão de cortesia sem regressão.

Seguir TDD nas alterações de comportamento. Executar testes dos módulos afetados e o pipeline obrigatório `pnpm turbo lint && pnpm turbo typecheck` antes de qualquer commit. Deploy e configuração de dados em produção não fazem parte da aprovação deste desenho.
