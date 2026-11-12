# Ações do ingresso: download e WhatsApp

## Intenção

Dar ao comprador duas ações explícitas em cada cartão de ingresso: baixar o PDF do ingresso e compartilhar o arquivo PDF pelo compartilhamento nativo do dispositivo, com o WhatsApp disponível como destino.

## Escopo

- Reutilizar `gerarPdfIngressos` e `nomeArquivoIngresso` para o download individual.
- Substituir o compartilhamento genérico do navegador por compartilhamento do arquivo PDF.
- Em celulares compatíveis, o usuário escolhe o WhatsApp na folha nativa e o PDF segue anexado.
- Em desktop ou navegadores sem compartilhamento de arquivos, baixar o PDF e orientar o anexo manual no WhatsApp.
- Preservar mensagens de carregamento, erro e acessibilidade dos botões.

## Abordagens consideradas

1. **PDF pela folha nativa de compartilhamento (escolhida):** usa o PDF já existente e permite escolher WhatsApp com o arquivo anexado em celulares compatíveis.
2. **Link direto do WhatsApp:** abre uma conversa com texto, mas não consegue anexar um Blob/PDF gerado no navegador.
3. **Upload do PDF e envio de anexo:** exigiria armazenamento temporário e uma integração adicional com a API do WhatsApp; é desnecessário para a necessidade atual.

## Decisões

- O botão de download gera somente o ingresso selecionado.
- O botão de compartilhar gera o PDF individual e chama `navigator.share` quando o navegador aceita arquivos.
- O fallback baixa o PDF e informa que ele deve ser anexado manualmente no WhatsApp.
- Testes cobrirão o compartilhamento do arquivo, o download individual e a presença dos dois botões no cartão.

## Fora do escopo

- Alterações no modelo de ingresso, no QR code, no webhook ou no backend.
- Envio automático de anexos pelo WhatsApp.
