import * as fs from 'node:fs';
import * as path from 'node:path';

type DrizzleJournal = {
  entries: Array<{ tag: string }>;
};

describe('controle de migrations do Drizzle', () => {
  it('registra todos os arquivos SQL no journal', () => {
    const migrationsLegadasSemJournal = new Set([
      '0011_add_historico_tarefas',
      '0018_fix_quinzena_id_type',
      '0022_update_historico_acao_constraint',
    ]);
    const migrationsDir = path.resolve(
      __dirname,
      '../../../../packages/db/drizzle',
    );
    const journalPath = path.join(migrationsDir, 'meta', '_journal.json');

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
});
