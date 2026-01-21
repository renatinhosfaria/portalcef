import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "dotenv";
import { join } from "path";
import { eq } from "drizzle-orm";

import { calendarEvents } from "../src/schema/calendar-events.js";
import { units, users } from "../src/schema/index.js";

// Carrega variáveis de ambiente
config({ path: join(__dirname, "../../../.env") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL não definida no .env");
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

// ============================================================================
// CALENDÁRIO ANO LETIVO 2026 - ESCOLA INFANTIL ESPAÇO FELIZ
// ============================================================================

interface EventoCalendario {
  title: string;
  description?: string;
  eventType:
    | "INICIO_SEMESTRE"
    | "TERMINO_SEMESTRE"
    | "FERIADO"
    | "RECESSO"
    | "FERIAS_PROFESSORES"
    | "SABADO_LETIVO"
    | "SEMANA_PROVAS"
    | "REUNIAO_PEDAGOGICA"
    | "EVENTO_ESPECIAL";
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  isSchoolDay: boolean;
  isRecurringAnnually: boolean;
}

// 🔵 Azul - Início/Término do semestre
const eventosSemestre: EventoCalendario[] = [
  {
    title: "Início do 1º Semestre Letivo",
    description: "Início das aulas do primeiro semestre de 2026",
    eventType: "INICIO_SEMESTRE",
    startDate: "2026-02-02",
    endDate: "2026-02-02",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },
  {
    title: "Término do 1º Semestre Letivo",
    description: "Último dia de aulas do primeiro semestre",
    eventType: "TERMINO_SEMESTRE",
    startDate: "2026-07-10",
    endDate: "2026-07-10",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },
  {
    title: "Início do 2º Semestre Letivo",
    description: "Retorno às aulas do segundo semestre de 2026",
    eventType: "INICIO_SEMESTRE",
    startDate: "2026-07-29",
    endDate: "2026-07-29",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },
  {
    title: "Término do 2º Semestre Letivo",
    description: "Último dia de aulas do ano letivo 2026",
    eventType: "TERMINO_SEMESTRE",
    startDate: "2026-12-18",
    endDate: "2026-12-18",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },
];

// 🟣 Roxo - Feriados e Recessos
const feriadosERecessos: EventoCalendario[] = [
  // Carnaval
  {
    title: "Carnaval",
    description: "Segunda e terça-feira de Carnaval + Quarta-feira de Cinzas",
    eventType: "FERIADO",
    startDate: "2026-02-16",
    endDate: "2026-02-18",
    isSchoolDay: false,
    isRecurringAnnually: false,
  },
  // Semana Santa
  {
    title: "Quinta-feira Santa",
    description: "Recesso de Semana Santa",
    eventType: "RECESSO",
    startDate: "2026-04-02",
    endDate: "2026-04-02",
    isSchoolDay: false,
    isRecurringAnnually: false,
  },
  {
    title: "Sexta-feira Santa",
    description: "Paixão de Cristo",
    eventType: "FERIADO",
    startDate: "2026-04-03",
    endDate: "2026-04-03",
    isSchoolDay: false,
    isRecurringAnnually: true,
  },
  // Tiradentes
  {
    title: "Emenda Tiradentes",
    description: "Recesso - emenda do feriado de Tiradentes",
    eventType: "RECESSO",
    startDate: "2026-04-20",
    endDate: "2026-04-20",
    isSchoolDay: false,
    isRecurringAnnually: false,
  },
  {
    title: "Tiradentes",
    description: "Feriado Nacional - Dia de Tiradentes",
    eventType: "FERIADO",
    startDate: "2026-04-21",
    endDate: "2026-04-21",
    isSchoolDay: false,
    isRecurringAnnually: true,
  },
  // Dia do Trabalho
  {
    title: "Dia do Trabalho",
    description: "Feriado Nacional",
    eventType: "FERIADO",
    startDate: "2026-05-01",
    endDate: "2026-05-01",
    isSchoolDay: false,
    isRecurringAnnually: true,
  },
  // Corpus Christi
  {
    title: "Corpus Christi",
    description: "Feriado Religioso",
    eventType: "FERIADO",
    startDate: "2026-06-04",
    endDate: "2026-06-04",
    isSchoolDay: false,
    isRecurringAnnually: false,
  },
  {
    title: "Emenda Corpus Christi",
    description: "Recesso - emenda do feriado de Corpus Christi",
    eventType: "RECESSO",
    startDate: "2026-06-05",
    endDate: "2026-06-05",
    isSchoolDay: false,
    isRecurringAnnually: false,
  },
  // Agosto
  {
    title: "Recesso",
    description: "Recesso escolar",
    eventType: "RECESSO",
    startDate: "2026-08-31",
    endDate: "2026-08-31",
    isSchoolDay: false,
    isRecurringAnnually: false,
  },
  // Independência do Brasil
  {
    title: "Independência do Brasil",
    description: "Feriado Nacional - 7 de Setembro",
    eventType: "FERIADO",
    startDate: "2026-09-07",
    endDate: "2026-09-07",
    isSchoolDay: false,
    isRecurringAnnually: true,
  },
  // Outubro - Semana das Crianças
  {
    title: "Nossa Senhora Aparecida",
    description: "Feriado Nacional - Padroeira do Brasil",
    eventType: "FERIADO",
    startDate: "2026-10-12",
    endDate: "2026-10-12",
    isSchoolDay: false,
    isRecurringAnnually: true,
  },
  {
    title: "Semana das Crianças",
    description: "Recesso da Semana das Crianças",
    eventType: "RECESSO",
    startDate: "2026-10-13",
    endDate: "2026-10-14",
    isSchoolDay: false,
    isRecurringAnnually: false,
  },
  {
    title: "Dia do Professor",
    description: "Feriado Escolar - Dia do Professor",
    eventType: "FERIADO",
    startDate: "2026-10-15",
    endDate: "2026-10-15",
    isSchoolDay: false,
    isRecurringAnnually: true,
  },
  {
    title: "Recesso Semana das Crianças",
    description: "Continuação do recesso",
    eventType: "RECESSO",
    startDate: "2026-10-16",
    endDate: "2026-10-16",
    isSchoolDay: false,
    isRecurringAnnually: false,
  },
  // Novembro
  {
    title: "Finados",
    description: "Feriado Nacional - Dia de Finados",
    eventType: "FERIADO",
    startDate: "2026-11-02",
    endDate: "2026-11-02",
    isSchoolDay: false,
    isRecurringAnnually: true,
  },
  {
    title: "Consciência Negra",
    description: "Feriado Nacional - Dia da Consciência Negra",
    eventType: "FERIADO",
    startDate: "2026-11-20",
    endDate: "2026-11-20",
    isSchoolDay: false,
    isRecurringAnnually: true,
  },
];

// 🟡 Amarelo - Férias e recesso dos professores
const feriasRecessoProfessores: EventoCalendario[] = [
  {
    title: "Férias de Janeiro",
    description: "Férias escolares e recesso dos professores",
    eventType: "FERIAS_PROFESSORES",
    startDate: "2026-01-01",
    endDate: "2026-01-28",
    isSchoolDay: false,
    isRecurringAnnually: false,
  },
  {
    title: "Férias de Julho",
    description: "Férias escolares e recesso dos professores",
    eventType: "FERIAS_PROFESSORES",
    startDate: "2026-07-13",
    endDate: "2026-07-28",
    isSchoolDay: false,
    isRecurringAnnually: false,
  },
  {
    title: "Férias de Dezembro",
    description: "Férias escolares e recesso dos professores",
    eventType: "FERIAS_PROFESSORES",
    startDate: "2026-12-21",
    endDate: "2026-12-31",
    isSchoolDay: false,
    isRecurringAnnually: false,
  },
];

// 🟢 Verde - Dias Escolares (planejamento/reuniões sem aula para alunos)
const diasEscolares: EventoCalendario[] = [
  {
    title: "Planejamento Início do Ano",
    description: "Dias de planejamento pedagógico antes do início das aulas",
    eventType: "REUNIAO_PEDAGOGICA",
    startDate: "2026-01-29",
    endDate: "2026-01-30",
    isSchoolDay: false,
    isRecurringAnnually: false,
  },
  {
    title: "Encerramento do Ano Letivo",
    description: "Dias de encerramento, reuniões e fechamento do ano",
    eventType: "REUNIAO_PEDAGOGICA",
    startDate: "2026-12-16",
    endDate: "2026-12-18",
    isSchoolDay: false,
    isRecurringAnnually: false,
  },
];

// 🟠 Laranja - Sábados Letivos
const sabadosLetivos: EventoCalendario[] = [
  {
    title: "Sábado Letivo - Maio",
    description: "Sábado letivo para reposição de dias",
    eventType: "SABADO_LETIVO",
    startDate: "2026-05-09",
    endDate: "2026-05-09",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },
  {
    title: "Sábado Letivo - Festa Junina",
    description: "Sábado letivo - Festa Junina",
    eventType: "SABADO_LETIVO",
    startDate: "2026-06-13",
    endDate: "2026-06-13",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },
  {
    title: "Sábado Letivo - Agosto",
    description: "Sábado letivo para reposição de dias",
    eventType: "SABADO_LETIVO",
    startDate: "2026-08-08",
    endDate: "2026-08-08",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },
];

// 🔷 Azul Escuro - Semana de Provas
const semanasProvas: EventoCalendario[] = [
  // 1º Bimestre
  {
    title: "Prova 1º Bimestre - Início",
    description: "Início das avaliações do 1º bimestre",
    eventType: "SEMANA_PROVAS",
    startDate: "2026-04-08",
    endDate: "2026-04-08",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },
  {
    title: "Semana de Provas - 1º Bimestre",
    description: "Avaliações do 1º bimestre",
    eventType: "SEMANA_PROVAS",
    startDate: "2026-04-13",
    endDate: "2026-04-17",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },
  // 2º Bimestre
  {
    title: "Prova 2º Bimestre - Início",
    description: "Início das avaliações do 2º bimestre",
    eventType: "SEMANA_PROVAS",
    startDate: "2026-06-24",
    endDate: "2026-06-24",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },
  {
    title: "Semana de Provas - 2º Bimestre",
    description: "Avaliações do 2º bimestre",
    eventType: "SEMANA_PROVAS",
    startDate: "2026-06-29",
    endDate: "2026-07-03",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },
  // 3º Bimestre
  {
    title: "Prova 3º Bimestre - Início",
    description: "Início das avaliações do 3º bimestre",
    eventType: "SEMANA_PROVAS",
    startDate: "2026-09-16",
    endDate: "2026-09-16",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },
  {
    title: "Semana de Provas - 3º Bimestre",
    description: "Avaliações do 3º bimestre",
    eventType: "SEMANA_PROVAS",
    startDate: "2026-09-21",
    endDate: "2026-09-25",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },
  // 4º Bimestre
  {
    title: "Prova 4º Bimestre - Início",
    description: "Início das avaliações do 4º bimestre",
    eventType: "SEMANA_PROVAS",
    startDate: "2026-12-02",
    endDate: "2026-12-02",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },
  {
    title: "Semana de Provas - 4º Bimestre",
    description: "Avaliações do 4º bimestre",
    eventType: "SEMANA_PROVAS",
    startDate: "2026-12-07",
    endDate: "2026-12-11",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },
];

// Combina todos os eventos
const todosEventos2026: EventoCalendario[] = [
  ...eventosSemestre,
  ...feriadosERecessos,
  ...feriasRecessoProfessores,
  ...diasEscolares,
  ...sabadosLetivos,
  ...semanasProvas,
];

async function seedCalendario2026() {
  try {
    console.log("🗓️  Iniciando seed do Calendário Ano Letivo 2026...\n");

    // Buscar todas as unidades
    const allUnits = await db.select().from(units);
    if (allUnits.length === 0) {
      console.error(
        "❌ Nenhuma unidade encontrada. Execute o seed básico primeiro.",
      );
      process.exit(1);
    }
    console.log(`🏢 Unidades encontradas: ${allUnits.length}\n`);

    // Buscar um usuário admin para ser o criador dos eventos
    const adminUsers = await db
      .select()
      .from(users)
      .where(eq(users.role, "master"))
      .limit(1);

    if (adminUsers.length === 0) {
      console.error("❌ Nenhum usuário master encontrado.");
      process.exit(1);
    }
    const creatorId = adminUsers[0].id;
    console.log(`👤 Criador dos eventos: ${adminUsers[0].name}\n`);

    let totalEventos = 0;

    // Criar eventos para cada unidade
    for (const unit of allUnits) {
      console.log(`\n📍 Criando eventos para: ${unit.name}`);

      for (const evento of todosEventos2026) {
        await db.insert(calendarEvents).values({
          unitId: unit.id,
          title: evento.title,
          description: evento.description || null,
          eventType: evento.eventType,
          startDate: new Date(evento.startDate),
          endDate: new Date(evento.endDate),
          isSchoolDay: evento.isSchoolDay,
          isRecurringAnnually: evento.isRecurringAnnually,
          createdBy: creatorId,
        });
        totalEventos++;
      }

      console.log(`   ✅ ${todosEventos2026.length} eventos criados`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ Seed do Calendário 2026 concluído com sucesso!\n");
    console.log("📊 Resumo:");
    console.log(`   - Unidades: ${allUnits.length}`);
    console.log(`   - Eventos por unidade: ${todosEventos2026.length}`);
    console.log(`   - Total de eventos criados: ${totalEventos}`);
    console.log("\n📅 Tipos de eventos criados:");
    console.log(`   🔵 Início/Término de Semestre: ${eventosSemestre.length}`);
    console.log(`   🟣 Feriados e Recessos: ${feriadosERecessos.length}`);
    console.log(`   🟡 Férias dos Professores: ${feriasRecessoProfessores.length}`);
    console.log(`   🟢 Dias Escolares: ${diasEscolares.length}`);
    console.log(`   🟠 Sábados Letivos: ${sabadosLetivos.length}`);
    console.log(`   🔷 Semanas de Provas: ${semanasProvas.length}`);
    console.log("=".repeat(60) + "\n");
  } catch (error) {
    console.error("❌ Erro ao aplicar seed:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

seedCalendario2026()
  .then(() => {
    console.log("🎉 Processo concluído!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Falha no seed:", error);
    process.exit(1);
  });
