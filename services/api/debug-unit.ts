
import { getDb, units, eq } from "@essencia/db";

async function main() {
    try {
        console.log("Checking unit existence...");
        const db = getDb();
        const unitId = "c594a8c2-cf99-45d9-b664-f99ee9623d64";
        const unit = await db.select().from(units).where(eq(units.id, unitId));

        if (unit.length > 0) {
            console.log("Unit found:", unit[0]);
        } else {
            console.log("Unit NOT found!");
        }
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}

main();
