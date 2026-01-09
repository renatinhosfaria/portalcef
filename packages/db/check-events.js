const postgres = require("postgres");
require("dotenv").config({ path: "../../.env" });

const sql = postgres(process.env.DATABASE_URL);

async function checkEvents() {
  try {
    const count = await sql`SELECT COUNT(*) as total FROM calendar_events`;
    console.log("\n========================================");
    console.log(`Total de eventos no banco: ${count[0].total}`);
    console.log("========================================\n");

    if (count[0].total > 0) {
      const events = await sql`
        SELECT title, event_type, start_date::text, end_date::text 
        FROM calendar_events 
        ORDER BY start_date 
        LIMIT 20
      `;
      
      console.log("Primeiros 20 eventos:\n");
      events.forEach((e, i) => {
        console.log(`${i + 1}. [${e.event_type}] ${e.title}`);
        console.log(`   ${e.start_date} até ${e.end_date}\n`);
      });
    }
  } catch (error) {
    console.error("Erro:", error.message);
  } finally {
    await sql.end();
  }
}

checkEvents();
