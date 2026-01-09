const postgres = require("postgres");
require("dotenv").config({ path: "../../.env" });

const sql = postgres(process.env.DATABASE_URL);

async function checkUnits() {
  try {
    // Verificar unit_id dos eventos
    const eventUnits = await sql`SELECT DISTINCT unit_id FROM calendar_events`;
    console.log("\n=== UnitIds dos eventos ===");
    eventUnits.forEach(e => console.log(e.unit_id));

    // Verificar todas as unidades
    const units = await sql`SELECT id, name FROM units`;
    console.log("\n=== Todas as unidades ===");
    units.forEach(u => console.log(`${u.id} - ${u.name}`));

    // Verificar usuário Isabella
    const users = await sql`SELECT id, name, role, unit_id FROM users WHERE name ILIKE '%isabella%'`;
    console.log("\n=== Usuário Isabella ===");
    users.forEach(u => console.log(`${u.id} - ${u.name} - ${u.role} - unit_id: ${u.unit_id}`));

  } catch (error) {
    console.error("Erro:", error.message);
  } finally {
    await sql.end();
  }
}

checkUnits();
