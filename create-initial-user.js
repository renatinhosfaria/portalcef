const bcrypt = require('bcrypt');

const password = '$Re150590';
const hash = bcrypt.hashSync(password, 10);

console.log(`Hash gerado: ${hash}`);

const sql = `
-- Inserir Escola
INSERT INTO schools (id, name, code, created_at, updated_at)
VALUES (gen_random_uuid(), 'Colégio Essencia Feliz', '001', now(), now())
RETURNING id;

-- Pegar o ID da escola (substitua SCHOOL_ID_AQUI pelo UUID retornado acima)
-- Inserir Unidade
INSERT INTO units (id, school_id, name, code, address, created_at, updated_at)
SELECT gen_random_uuid(), s.id, 'Santa Mônica', '001', 'Rua Lourdes de Carvalho, 1212 - Bairro Segismundo Pereira, Uberlândia - MG, 38408-268', now(), now()
FROM schools s
WHERE s.code = '001'
RETURNING id;

-- Inserir Usuário Master
INSERT INTO users (id, email, password_hash, name, role, school_id, unit_id, stage_id, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'renato@famanegociosimobiliarios.com.br',
  '${hash}',
  'Renato',
  'master',
  NULL,
  NULL,
  NULL,
  now(),
  now()
);
`;

console.log('\n--- SQL para executar no PostgreSQL ---\n');
console.log(sql);
