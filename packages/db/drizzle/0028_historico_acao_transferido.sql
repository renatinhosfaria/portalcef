-- Migration: 0028_historico_acao_transferido.sql
-- Adiciona valor TRANSFERIDO ao CHECK constraint de plano_aula_historico.acao
-- Necessário para suportar registro de transferência de plano de aula entre professoras

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
  'TRANSFERIDO'
));
