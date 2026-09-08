-- Migration: permitir DOCUMENTO_EXCLUIDO no histórico de planos de aula
-- Necessário para registrar a exclusão justificada de documentos não aprovados

ALTER TABLE "plano_aula_historico" DROP CONSTRAINT "chk_plano_historico_acao";--> statement-breakpoint
ALTER TABLE "plano_aula_historico" ADD CONSTRAINT "chk_plano_historico_acao" CHECK ("acao" IN (
  'CRIADO',
  'SUBMETIDO',
  'APROVADO_ANALISTA',
  'DEVOLVIDO_ANALISTA',
  'APROVADO_COORDENADORA',
  'DEVOLVIDO_COORDENADORA',
  'DOCUMENTO_IMPRESSO',
  'RECUPERADO',
  'COMENTARIO_ADICIONADO',
  'TRANSFERIDO',
  'DOCUMENTO_EXCLUIDO'
));
