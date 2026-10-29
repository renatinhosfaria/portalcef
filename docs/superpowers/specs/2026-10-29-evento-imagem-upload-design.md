# Upload de imagem do evento

## Intenção

Permitir que a equipe administrativa selecione uma imagem no computador durante a etapa de informações do evento. A imagem deve ser armazenada no storage do Portal CEF, vinculada ao evento e disponibilizada pela URL salva em `imageUrl` para uso posterior na página pública.

## Objetivos

- Adicionar um seletor de arquivo no campo de imagem do workspace administrativo.
- Criar uma rota específica `POST /eventos/admin/:id/imagem`.
- Aceitar somente imagens raster já suportadas pelo storage (`jpeg`, `png`, `webp` e `gif`).
- Validar escopo do evento com o usuário autenticado.
- Salvar os arquivos sob o prefixo `eventos/:id/imagem`.
- Atualizar `imageUrl` no evento sem depender de uma segunda ação manual.
- Remover o arquivo anterior somente depois que a nova imagem estiver armazenada e o evento atualizado.
- Mostrar estado de envio, erro e pré-visualização no painel.

## Fora de escopo

- Redimensionamento ou edição da imagem.
- Upload direto do navegador por URL assinada.
- Galeria de múltiplas imagens.
- Alteração do contrato da página pública; ela continuará consumindo `imageUrl`.

## Abordagens consideradas

1. Reutilizar `/storage/upload`: menor alteração, mas não vincula o arquivo ao evento e dificulta a substituição segura.
2. Criar rota específica do evento: escolhida porque mantém autorização, organização dos arquivos e substituição no domínio do evento.
3. Upload direto com URL assinada: mais escalável, porém desnecessário para o volume e o fluxo atuais.

## Desenho escolhido

O controller administrativo receberá multipart em `POST /eventos/admin/:id/imagem`. O service buscará o evento, validará o escopo escolar, fará o upload usando `StorageService.uploadBuffer` com validação raster e prefixo do evento, atualizará `imageUrl` e `updatedAt`, e removerá o arquivo antigo após a atualização. Falhas de atualização tentarão remover o novo arquivo para evitar órfãos.

No painel, o input de arquivo substituirá o campo textual de URL. Ao selecionar um arquivo, o cliente enviará `FormData`, exibirá progresso lógico (`enviando`, `enviado` ou `erro`), atualizará o valor local com a URL retornada e manterá o autosave concorrente protegido pela versão atual do evento. Uma prévia será renderizada quando houver URL.

## Verificação

- Testes do controller/service para autorização, tipo inválido, atualização da URL, remoção da imagem anterior e limpeza em falha.
- Teste do componente para envio multipart e atualização da prévia.
- Suíte do painel, suíte da API, lint e typecheck.

