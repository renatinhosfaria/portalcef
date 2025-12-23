-- Migration: roles_hierarchy
-- Description: Update user roles enum and make schoolId/unitId optional

-- Step 1: Make school_id and unit_id nullable
ALTER TABLE "users" ALTER COLUMN "school_id" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "unit_id" DROP NOT NULL;

-- Step 2: Migrate existing roles to new values
UPDATE "users" SET "role" = 'diretora_geral' WHERE "role" = 'diretora';
UPDATE "users" SET "role" = 'gerente_unidade' WHERE "role" = 'gerente';
UPDATE "users" SET "role" = 'analista_pedagogico' WHERE "role" = 'supervisora';
UPDATE "users" SET "role" = 'coordenadora_geral' WHERE "role" = 'coordenadora';
-- Note: professora, auxiliar_sala, auxiliar_administrativo remain unchanged
