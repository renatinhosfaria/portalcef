import * as fs from 'node:fs';
import * as path from 'node:path';

type DrizzleJournal = {
  entries: Array<{ idx: number; tag: string; when: number }>;
};

describe('controle de migrations do Drizzle', () => {
  const migrationsDir = path.resolve(
    __dirname,
    '../../../../packages/db/drizzle',
  );
  const journalPath = path.join(migrationsDir, 'meta', '_journal.json');

  it('registra todos os arquivos SQL no journal', () => {
    const migrationsLegadasSemJournal = new Set([
      '0011_add_historico_tarefas',
      '0018_fix_quinzena_id_type',
      '0022_update_historico_acao_constraint',
    ]);

    const sqlTags = fs
      .readdirSync(migrationsDir)
      .filter((arquivo) => /^\d{4}_.+\.sql$/.test(arquivo))
      .map((arquivo) => arquivo.replace(/\.sql$/, ''))
      .sort();

    const journal = JSON.parse(
      fs.readFileSync(journalPath, 'utf8'),
    ) as DrizzleJournal;
    const journalTags = new Set(journal.entries.map((entry) => entry.tag));

    const migrationsSemRegistro = sqlTags.filter(
      (tag) => !journalTags.has(tag) && !migrationsLegadasSemJournal.has(tag),
    );

    expect(migrationsSemRegistro).toEqual([]);
  });

  it('mantém timestamps crescentes na ordem dos índices', () => {
    const journal = JSON.parse(
      fs.readFileSync(journalPath, 'utf8'),
    ) as DrizzleJournal;
    const entriesOrdenadas = [...journal.entries].sort(
      (a, b) => a.idx - b.idx,
    );

    const entradasForaDeOrdem = entriesOrdenadas
      .map((entry, index) => ({ entry, anterior: entriesOrdenadas[index - 1] }))
      .filter(({ entry, anterior }) => anterior && entry.when <= anterior.when)
      .map(
        ({ entry, anterior }) =>
          `${entry.tag} (${entry.when}) <= ${anterior.tag} (${anterior.when})`,
      );

    expect(entradasForaDeOrdem).toEqual([]);
  });
});
