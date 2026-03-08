-- Migration: 0022_update_historico_acao_constraint.sql
-- Atualizar CHECK constraint para incluir novas ações do histórico

ALTER TABLE "plano_aula_historico" DROP CONSTRAINT "chk_plano_historico_acao";
ALTER TABLE "plano_aula_historico" ADD CONSTRAINT "chk_plano_historico_acao" CHECK ("acao" IN (
  'CRIADO',
  'SUBMETIDO',
  'APROVADO_ANALISTA',
  'DEVOLVIDO_ANALISTA',
  'APROVADO_COORDENADORA',
  'DEVOLVIDO_COORDENADORA',
  'DOCUMENTO_IMPRESSO',
  'RECUPERADO',
  'COMENTARIO_ADICIONADO'
));
