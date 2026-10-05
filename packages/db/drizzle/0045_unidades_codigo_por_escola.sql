-- O código da unidade identifica a unidade dentro da escola.
-- O índice anterior usava o id da própria linha e não impedia duplicidades.
DROP INDEX IF EXISTS "units_id_school_id_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "units_school_code_unique"
  ON "units" USING btree ("school_id", "code");
