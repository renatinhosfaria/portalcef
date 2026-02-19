-- Migration: Corrigir tipo do campo quinzena_id de varchar(10) para uuid
-- Problema: O schema Drizzle define quinzena_id como uuid, mas o banco estava com varchar(10)
-- Isso causava erro "value too long for type character varying(10)" ao inserir UUIDs

-- Alterar o tipo da coluna quinzena_id na tabela plano_aula
ALTER TABLE "plano_aula" ALTER COLUMN "quinzena_id" TYPE uuid USING "quinzena_id"::uuid;

-- Alterar o tipo da coluna quinzena_id na tabela tarefa_contextos (se existir registros)
ALTER TABLE "tarefa_contextos" ALTER COLUMN "quinzena_id" TYPE uuid USING "quinzena_id"::uuid;

-- Alterar o tipo da coluna quinzena_id na tabela quinzena_config (se existir registros)
ALTER TABLE "quinzena_config" ALTER COLUMN "quinzena_id" TYPE uuid USING "quinzena_id"::uuid;
