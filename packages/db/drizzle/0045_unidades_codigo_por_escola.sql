-- O código da unidade identifica a unidade dentro da escola.
-- O índice de id e escola deve permanecer: sustenta users_unit_school_fk.
CREATE UNIQUE INDEX "units_school_code_unique"
  ON "units" USING btree ("school_id", "code");
