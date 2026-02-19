import * as dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { getDb, closeDb } from "./index.js";
import { users } from "./schema/users.js";

dotenv.config({ path: "../../.env" });

async function getMasterEmail() {
    const db = getDb();

    try {
        const [masterUser] = await db
            .select()
            .from(users)
            .where(eq(users.role, "master"))
            .limit(1);

        if (!masterUser) {
            console.error("❌ Usuário master não encontrado");
            process.exit(1);
        }

        console.log(`📧 Email: ${masterUser.email}`);
    } catch (error) {
        console.error("❌ Erro:", error);
        process.exit(1);
    } finally {
        await closeDb();
        process.exit(0);
    }
}

getMasterEmail();
