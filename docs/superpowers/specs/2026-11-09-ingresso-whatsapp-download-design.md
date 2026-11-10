# Ações do ingresso: download e WhatsApp

## Intenção

Dar ao comprador duas ações explícitas em cada cartão de ingresso: baixar o PDF do ingresso e abrir uma conversa do WhatsApp já preenchida com os dados do ingresso.

## Escopo

- Reutilizar `gerarPdfIngressos` e `nomeArquivoIngresso` para o download individual.
- Substituir o compartilhamento genérico do navegador por um link `wa.me` com mensagem codificada.
- A mensagem conterá evento, data, local, fileira, assento, tipo, número do ingresso e a URL atual da página.
- Manter o QR payload fora da mensagem e sem alteração no backend.
- Preservar mensagens de carregamento, erro e acessibilidade dos botões.

## Abordagens consideradas

1. **Download individual + WhatsApp direto (escolhida):** usa o PDF já existente e abre `https://wa.me/?text=...`; funciona no celular e no WhatsApp Web sem backend novo.
2. **Web Share API:** mantém a folha nativa de compartilhamento e deixa o usuário escolher WhatsApp; não atende ao pedido de abrir diretamente o WhatsApp.
3. **Upload do PDF e envio de anexo:** exigiria armazenamento temporário e uma integração adicional com a API do WhatsApp; é desnecessário para a necessidade atual.

## Decisões

- O botão de download gera somente o ingresso selecionado.
- O botão de WhatsApp abre uma nova aba ou o aplicativo conforme o comportamento do navegador.
- A URL compartilhada é a URL atual do pedido, sem incluir o QR payload na mensagem.
- Testes cobrirão a URL/mensagem codificada, o download individual e a presença dos dois botões no cartão.

## Fora do escopo

- Alterações no modelo de ingresso, no QR code, no webhook ou no backend.
- Envio automático de anexos pelo WhatsApp.
