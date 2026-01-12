/**
 * ⚠️ SCRIPT DE SEED OPCIONAL - Calendário Escolar 2026
 * 
 * Este script popula o banco de dados com os eventos do calendário escolar de 2026.
 * Extraído da imagem do calendário oficial da escola.
 * 
 * ⚠️ ATENÇÃO: Este é um script de dados de exemplo/seed.
 * Execute apenas se desejar popular o banco com dados de teste/exemplo.
 * 
 * Para executar: node packages/db/seed-calendar-2026.js
 * 
 * Legenda de cores:
 * - Azul = Início ou término do semestre
 * - Vermelho/Rosa = Feriados e recessos
 * - Amarelo/Laranja = Férias e recesso dos professores
 * - Verde = Sábado letivo
 * - Roxo = Semana de provas
 * - Branco = Dia escolar (dias letivos)
 */

const postgres = require("postgres");
require("dotenv").config({ path: "../../.env" });

const sql = postgres(process.env.DATABASE_URL);

// Eventos extraídos da imagem do calendário 2026
const events2026 = [
  // ========== JANEIRO 2026 - Férias dos Professores ==========
  {
    title: "Férias dos Professores - Janeiro",
    description: "Período de férias escolares de janeiro",
    eventType: "FERIAS_PROFESSORES",
    startDate: "2026-01-01",
    endDate: "2026-01-31",
    isSchoolDay: false,
    isRecurringAnnually: false,
  },

  // ========== FEVEREIRO 2026 - 17 dias letivos ==========
  {
    title: "Início do Ano Letivo 2026",
    description: "Primeiro dia de aulas do ano letivo 2026",
    eventType: "INICIO_SEMESTRE",
    startDate: "2026-02-02",
    endDate: "2026-02-02",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },
  {
    title: "Carnaval",
    description: "Feriado de Carnaval",
    eventType: "FERIADO",
    startDate: "2026-02-14",
    endDate: "2026-02-17",
    isSchoolDay: false,
    isRecurringAnnually: true,
  },
  {
    title: "Quarta-feira de Cinzas",
    description: "Recesso de Quarta-feira de Cinzas",
    eventType: "RECESSO",
    startDate: "2026-02-18",
    endDate: "2026-02-18",
    isSchoolDay: false,
    isRecurringAnnually: true,
  },

  // ========== MARÇO 2026 - 22 dias letivos ==========
  {
    title: "Término do 1º Bimestre",
    description: "Último dia do primeiro bimestre letivo",
    eventType: "TERMINO_SEMESTRE",
    startDate: "2026-03-31",
    endDate: "2026-03-31",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },

  // ========== ABRIL 2026 - 18 dias letivos ==========
  {
    title: "Semana Santa",
    description: "Feriado da Semana Santa (Paixão de Cristo)",
    eventType: "FERIADO",
    startDate: "2026-04-02",
    endDate: "2026-04-03",
    isSchoolDay: false,
    isRecurringAnnually: true,
  },
  {
    title: "Início do 2º Bimestre",
    description: "Primeiro dia do segundo bimestre",
    eventType: "INICIO_SEMESTRE",
    startDate: "2026-04-06",
    endDate: "2026-04-06",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },
  {
    title: "Tiradentes",
    description: "Feriado de Tiradentes",
    eventType: "FERIADO",
    startDate: "2026-04-21",
    endDate: "2026-04-21",
    isSchoolDay: false,
    isRecurringAnnually: true,
  },
  {
    title: "Semana de Provas - 1º Bimestre",
    description: "Período de avaliações do primeiro bimestre",
    eventType: "SEMANA_PROVAS",
    startDate: "2026-04-27",
    endDate: "2026-04-30",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },

  // ========== MAIO 2026 - 21 dias letivos ==========
  {
    title: "Dia do Trabalho",
    description: "Feriado do Dia do Trabalho",
    eventType: "FERIADO",
    startDate: "2026-05-01",
    endDate: "2026-05-01",
    isSchoolDay: false,
    isRecurringAnnually: true,
  },
  {
    title: "Semana de Provas - 2º Bimestre",
    description: "Período de avaliações do segundo bimestre",
    eventType: "SEMANA_PROVAS",
    startDate: "2026-05-25",
    endDate: "2026-05-29",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },

  // ========== JUNHO 2026 - 21 dias letivos ==========
  {
    title: "Sábado Letivo",
    description: "Sábado letivo compensatório",
    eventType: "SABADO_LETIVO",
    startDate: "2026-06-06",
    endDate: "2026-06-06",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },
  {
    title: "Corpus Christi",
    description: "Feriado de Corpus Christi",
    eventType: "FERIADO",
    startDate: "2026-06-04",
    endDate: "2026-06-04",
    isSchoolDay: false,
    isRecurringAnnually: true,
  },
  {
    title: "Recesso de Corpus Christi",
    description: "Recesso escolar após Corpus Christi",
    eventType: "RECESSO",
    startDate: "2026-06-05",
    endDate: "2026-06-05",
    isSchoolDay: false,
    isRecurringAnnually: false,
  },
  {
    title: "Término do 1º Semestre",
    description: "Último dia do primeiro semestre letivo",
    eventType: "TERMINO_SEMESTRE",
    startDate: "2026-06-30",
    endDate: "2026-06-30",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },

  // ========== JULHO 2026 - 11 dias letivos ==========
  {
    title: "Recesso Escolar - Julho",
    description: "Período de recesso escolar de meio de ano",
    eventType: "RECESSO",
    startDate: "2026-07-04",
    endDate: "2026-07-05",
    isSchoolDay: false,
    isRecurringAnnually: false,
  },
  {
    title: "Férias dos Professores - Julho",
    description: "Férias de meio de ano dos professores",
    eventType: "FERIAS_PROFESSORES",
    startDate: "2026-07-06",
    endDate: "2026-07-31",
    isSchoolDay: false,
    isRecurringAnnually: false,
  },

  // ========== AGOSTO 2026 - 21 dias letivos ==========
  {
    title: "Sábado Letivo",
    description: "Sábado letivo compensatório",
    eventType: "SABADO_LETIVO",
    startDate: "2026-08-01",
    endDate: "2026-08-01",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },
  {
    title: "Início do 2º Semestre",
    description: "Primeiro dia do segundo semestre letivo",
    eventType: "INICIO_SEMESTRE",
    startDate: "2026-08-03",
    endDate: "2026-08-03",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },
  {
    title: "Sábado Letivo",
    description: "Sábado letivo compensatório",
    eventType: "SABADO_LETIVO",
    startDate: "2026-08-15",
    endDate: "2026-08-15",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },

  // ========== SETEMBRO 2026 - 21 dias letivos ==========
  {
    title: "Independência do Brasil",
    description: "Feriado da Independência do Brasil",
    eventType: "FERIADO",
    startDate: "2026-09-07",
    endDate: "2026-09-07",
    isSchoolDay: false,
    isRecurringAnnually: true,
  },
  {
    title: "Semana de Provas - 3º Bimestre",
    description: "Período de avaliações do terceiro bimestre",
    eventType: "SEMANA_PROVAS",
    startDate: "2026-09-21",
    endDate: "2026-09-25",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },
  {
    title: "Término do 3º Bimestre",
    description: "Último dia do terceiro bimestre",
    eventType: "TERMINO_SEMESTRE",
    startDate: "2026-09-30",
    endDate: "2026-09-30",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },

  // ========== OUTUBRO 2026 - 17 dias letivos ==========
  {
    title: "Início do 4º Bimestre",
    description: "Primeiro dia do quarto bimestre",
    eventType: "INICIO_SEMESTRE",
    startDate: "2026-10-01",
    endDate: "2026-10-01",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },
  {
    title: "Nossa Senhora Aparecida",
    description: "Feriado de Nossa Senhora Aparecida",
    eventType: "FERIADO",
    startDate: "2026-10-12",
    endDate: "2026-10-12",
    isSchoolDay: false,
    isRecurringAnnually: true,
  },
  {
    title: "Dia do Professor",
    description: "Recesso do Dia do Professor",
    eventType: "RECESSO",
    startDate: "2026-10-15",
    endDate: "2026-10-15",
    isSchoolDay: false,
    isRecurringAnnually: true,
  },
  {
    title: "Semana de Provas - 4º Bimestre",
    description: "Período de avaliações do quarto bimestre",
    eventType: "SEMANA_PROVAS",
    startDate: "2026-10-26",
    endDate: "2026-10-30",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },

  // ========== NOVEMBRO 2026 - 20 dias letivos ==========
  {
    title: "Finados",
    description: "Feriado de Finados",
    eventType: "FERIADO",
    startDate: "2026-11-02",
    endDate: "2026-11-02",
    isSchoolDay: false,
    isRecurringAnnually: true,
  },
  {
    title: "Proclamação da República",
    description: "Feriado da Proclamação da República",
    eventType: "FERIADO",
    startDate: "2026-11-15",
    endDate: "2026-11-15",
    isSchoolDay: false,
    isRecurringAnnually: true,
  },
  {
    title: "Sábado Letivo",
    description: "Sábado letivo compensatório",
    eventType: "SABADO_LETIVO",
    startDate: "2026-11-21",
    endDate: "2026-11-21",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },
  {
    title: "Semana de Provas Finais",
    description: "Período de avaliações finais do ano letivo",
    eventType: "SEMANA_PROVAS",
    startDate: "2026-11-23",
    endDate: "2026-11-28",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },

  // ========== DEZEMBRO 2026 - 11 dias letivos ==========
  {
    title: "Sábado Letivo",
    description: "Sábado letivo compensatório",
    eventType: "SABADO_LETIVO",
    startDate: "2026-12-05",
    endDate: "2026-12-05",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },
  {
    title: "Término do Ano Letivo 2026",
    description: "Último dia de aulas do ano letivo 2026",
    eventType: "TERMINO_SEMESTRE",
    startDate: "2026-12-18",
    endDate: "2026-12-18",
    isSchoolDay: true,
    isRecurringAnnually: false,
  },
  {
    title: "Férias dos Professores - Dezembro",
    description: "Início das férias de fim de ano",
    eventType: "FERIAS_PROFESSORES",
    startDate: "2026-12-19",
    endDate: "2026-12-31",
    isSchoolDay: false,
    isRecurringAnnually: false,
  },
];

async function populateCalendar() {
  try {
    // Buscar o primeiro usuário com role master ou diretora_geral para ser o criador
    const users = await sql`
      SELECT id FROM users 
      WHERE role IN ('master', 'diretora_geral') 
      LIMIT 1
    `;

    if (users.length === 0) {
      console.error("Nenhum usuário master ou diretora_geral encontrado!");
      process.exit(1);
    }

    const createdBy = users[0].id;
    console.log(`Usando usuário ${createdBy} como criador dos eventos`);

    // Buscar a primeira unidade disponível
    const units = await sql`
      SELECT id, name FROM units LIMIT 1
    `;

    if (units.length === 0) {
      console.error("Nenhuma unidade encontrada!");
      process.exit(1);
    }

    const unitId = units[0].id;
    console.log(`Criando eventos para a unidade: ${units[0].name} (${unitId})`);

    // Limpar eventos existentes para 2026 (opcional - comentar se não quiser)
    const deleted = await sql`
      DELETE FROM calendar_events 
      WHERE EXTRACT(YEAR FROM start_date) = 2026
      RETURNING id
    `;
    console.log(`${deleted.length} eventos existentes de 2026 removidos`);

    // Inserir novos eventos
    let inserted = 0;
    for (const event of events2026) {
      await sql`
        INSERT INTO calendar_events (
          unit_id,
          title,
          description,
          event_type,
          start_date,
          end_date,
          is_school_day,
          is_recurring_annually,
          created_by
        ) VALUES (
          ${unitId},
          ${event.title},
          ${event.description},
          ${event.eventType},
          ${event.startDate},
          ${event.endDate},
          ${event.isSchoolDay},
          ${event.isRecurringAnnually},
          ${createdBy}
        )
      `;
      inserted++;
      console.log(`✓ ${event.title} (${event.startDate} - ${event.endDate})`);
    }

    console.log(`\n========================================`);
    console.log(`Total de ${inserted} eventos inseridos com sucesso!`);
    console.log(`========================================\n`);

    // Mostrar resumo por tipo
    const summary = await sql`
      SELECT event_type, COUNT(*) as total
      FROM calendar_events
      WHERE EXTRACT(YEAR FROM start_date) = 2026
      GROUP BY event_type
      ORDER BY total DESC
    `;

    console.log("Resumo por tipo de evento:");
    for (const row of summary) {
      console.log(`  - ${row.event_type}: ${row.total} evento(s)`);
    }

  } catch (error) {
    console.error("Erro ao popular calendário:", error);
  } finally {
    await sql.end();
  }
}

populateCalendar();
