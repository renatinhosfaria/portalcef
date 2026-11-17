// Executado somente pelo runner que cria o PostgreSQL descartável.
const { readFileSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { getDb, closeDb, sql } = require('../../../packages/db/dist');
(async () => {
  if (process.env.EVENTOS_BANCO_TESTE !== '1' || !process.env.DATABASE_URL?.endsWith('/eventos_teste')) throw new Error('Banco de teste obrigatório');
  const db = getDb();
  await db.execute(sql.raw('CREATE TABLE schools (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, code text UNIQUE NOT NULL, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()); CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid());'));
  const pasta = resolve(__dirname, '../../../packages/db/drizzle');
  const arquivos = readdirSync(pasta).filter((nome) => /^\d+.*\.sql$/.test(nome) && Number(nome.slice(0, 4)) >= 49 && /evento/.test(nome)).sort();
  for (const arquivo of arquivos) {
    const comandos = readFileSync(resolve(pasta, arquivo), 'utf8').split('--> statement-breakpoint');
    await db.transaction(async (tx) => { for (const comando of comandos) if (comando.trim()) await tx.execute(sql.raw(comando)); });
  }
  await closeDb();
})().catch((erro) => { console.error(erro); process.exitCode = 1; });
