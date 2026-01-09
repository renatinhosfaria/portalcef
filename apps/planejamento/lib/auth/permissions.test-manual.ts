import {
  canAccessPlanejamento,
  canEditPlanning,
  getSegmentPrefix,
  getUserSegment,
} from "./permissions";
import { getPlanningsWhereClause } from "./queries";

// Mock minimal user context
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUser = (role: any, id = "user-123") => ({ id, role });

console.log("🚀 Iniciando testes de RBAC Permissions Logic...\n");

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`✅ PASS: ${desc}`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${desc}`);
    failed++;
  }
}

// 1. Teste getUserSegment
console.log("\n1. Testando getUserSegment:");
assert(
  getUserSegment("coordenadora_infantil") === "INFANTIL",
  "Coord Infantil -> INFANTIL",
);
assert(
  getUserSegment("coordenadora_fundamental_i") === "FUNDAMENTAL_I",
  "Coord Fundamental I -> FUNDAMENTAL_I",
);
assert(getUserSegment("professora") === "ALL", "Professora -> ALL (default)");
assert(getUserSegment("diretora_geral") === "ALL", "Diretora -> ALL");

// 2. Teste getSegmentPrefix
console.log("\n2. Testando getSegmentPrefix:");
assert(getSegmentPrefix("INFANTIL") === "INF-%", "INFANTIL -> INF-%");
assert(
  getSegmentPrefix("FUNDAMENTAL_I") === "FUND-I-%",
  "FUNDAMENTAL_I -> FUND-I-%",
);
assert(getSegmentPrefix("ALL") === null, "ALL -> null");

// 3. Teste canAccessPlanejamento
console.log("\n3. Testando canAccessPlanejamento:");
assert(canAccessPlanejamento("professora") === true, "Professora tem acesso");
assert(
  canAccessPlanejamento("coordenadora_infantil") === true,
  "Coordenação tem acesso",
);
assert(canAccessPlanejamento("master") === true, "Master tem acesso");
assert(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  canAccessPlanejamento("auxiliar_administrativo" as any) === false,
  "Auxiliar Administrativo NÃO tem acesso",
);

// 4. Teste canEditPlanning
console.log("\n4. Testando canEditPlanning:");
// Professor editando seu próprio
assert(
  canEditPlanning("professora", "user-1", "user-1") === true,
  "Professora edita seu próprio planejamento",
);
// Professor editando de outro
assert(
  canEditPlanning("professora", "user-1", "user-2") === false,
  "Professora NÃO edita planejamento alheio",
);
// Coordenação não edita
assert(
  canEditPlanning("coordenadora_infantil", "coord-1", "user-1") === false,
  "Coordenação NÃO edita planejamento",
);

// 5. Teste getPlanningsWhereClause (Lógica)
console.log("\n5. Testando Query Builders (Lógica):");

const whereProf = getPlanningsWhereClause(mockUser("professora", "prof-1"));
// Como não podemos testar o objeto SQL diretamente facilmente sem conexão, verificamos se retornou algo
assert(
  whereProf !== undefined,
  "Query Builders para professora retorna cláusula",
);

const whereCoord = getPlanningsWhereClause(mockUser("coordenadora_infantil"));
assert(
  whereCoord !== undefined,
  "Query Builders para coordenação retorna cláusula",
);

const whereDir = getPlanningsWhereClause(mockUser("diretora_geral"));
assert(
  whereDir === undefined,
  "Query Builders para direção retorna undefined (sem filtro)",
);

console.log(`\n\nResultados: ${passed} passaram, ${failed} falharam.`);
if (failed > 0) process.exit(1);
