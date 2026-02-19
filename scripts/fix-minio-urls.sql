-- ============================================
-- Script para atualizar URLs do MinIO
-- Substitui http://minio:9000 por https://www.portalcef.com.br/storage
-- ============================================

-- IMPORTANTE: Execute este script após atualizar docker-compose.prod.yml
-- e reiniciar os containers api e worker

-- Verificar quantos registros precisam ser atualizados
SELECT 
    'plano_documento.url' as campo,
    COUNT(*) as total
FROM plano_documento 
WHERE url LIKE '%minio:9000%'
UNION ALL
SELECT 
    'plano_documento.preview_url' as campo,
    COUNT(*) as total
FROM plano_documento 
WHERE preview_url LIKE '%minio:9000%'
UNION ALL
SELECT 
    'quinzena_documents.file_url' as campo,
    COUNT(*) as total
FROM quinzena_documents 
WHERE file_url LIKE '%minio:9000%';

-- Atualizar plano_documento.url
UPDATE plano_documento 
SET 
    url = REPLACE(url, 'http://minio:9000', 'https://www.portalcef.com.br/storage'),
    updated_at = NOW()
WHERE url LIKE '%minio:9000%';

-- Atualizar plano_documento.preview_url
UPDATE plano_documento 
SET 
    preview_url = REPLACE(preview_url, 'http://minio:9000', 'https://www.portalcef.com.br/storage'),
    updated_at = NOW()
WHERE preview_url LIKE '%minio:9000%';

-- Atualizar quinzena_documents.file_url
UPDATE quinzena_documents 
SET 
    file_url = REPLACE(file_url, 'http://minio:9000', 'https://www.portalcef.com.br/storage'),
    updated_at = NOW()
WHERE file_url LIKE '%minio:9000%';

-- Verificar resultados
SELECT 
    'Registros restantes com URL antiga' as status,
    (
        SELECT COUNT(*) FROM plano_documento WHERE url LIKE '%minio:9000%'
    ) + (
        SELECT COUNT(*) FROM plano_documento WHERE preview_url LIKE '%minio:9000%'
    ) + (
        SELECT COUNT(*) FROM quinzena_documents WHERE file_url LIKE '%minio:9000%'
    ) as total;
