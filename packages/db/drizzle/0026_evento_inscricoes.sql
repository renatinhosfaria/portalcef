-- Tabela: evento_inscricoes
-- Inscrições para eventos abertos da escola (ex: "Mãe por Inteiro").
-- Endpoint público — sem tenant context obrigatório.

CREATE TABLE IF NOT EXISTS "evento_inscricoes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "evento_slug" varchar(80) NOT NULL,
  "nome" varchar(200) NOT NULL,
  "cpf" varchar(14) NOT NULL,
  "data_nascimento" date NOT NULL,
  "email" varchar(200) NOT NULL,
  "telefone" varchar(20) NOT NULL,
  "ip_address" varchar(45),
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Uma mesma mãe (CPF) só pode se inscrever uma vez por evento
CREATE UNIQUE INDEX IF NOT EXISTS "uq_evento_inscricoes_evento_cpf"
  ON "evento_inscricoes" USING btree ("evento_slug", "cpf");

CREATE INDEX IF NOT EXISTS "idx_evento_inscricoes_evento_slug"
  ON "evento_inscricoes" USING btree ("evento_slug");

CREATE INDEX IF NOT EXISTS "idx_evento_inscricoes_created_at"
  ON "evento_inscricoes" USING btree ("created_at");

-- Tabela: evento_inscricao_filhos
-- Cada inscrição pode ter 1+ filhos com nome e turma.

CREATE TABLE IF NOT EXISTS "evento_inscricao_filhos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "inscricao_id" uuid NOT NULL,
  "nome_filho" varchar(200) NOT NULL,
  "turma_filho" varchar(80) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "evento_inscricao_filhos_inscricao_id_fk"
    FOREIGN KEY ("inscricao_id")
    REFERENCES "evento_inscricoes"("id")
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_evento_filhos_inscricao_id"
  ON "evento_inscricao_filhos" USING btree ("inscricao_id");

CREATE INDEX IF NOT EXISTS "idx_evento_filhos_turma"
  ON "evento_inscricao_filhos" USING btree ("turma_filho");
