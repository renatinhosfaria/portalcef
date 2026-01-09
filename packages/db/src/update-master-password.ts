import * as dotenv from "dotenv";
import * as bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { getDb, closeDb } from "./index.js";
import { users } from "./schema/users.js";

dotenv.config({ path: "../../.env" });

async function updateMasterPassword() {
  const db = getDb();
  const newPassword = "$Re150590";

  console.log("🔐 Atualizando senha do usuário master...");

  try {
    // Buscar usuário master
    const [masterUser] = await db
      .select()
      .from(users)
      .where(eq(users.role, "master"))
      .limit(1);

    if (!masterUser) {
      console.error("❌ Usuário master não encontrado");
      process.exit(1);
    }

    console.log(`📧 Usuário encontrado: ${masterUser.email}`);

    // Hash da nova senha
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Atualizar senha
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, masterUser.id));

    console.log("✅ Senha atualizada com sucesso!");
    console.log(`📧 Email: ${masterUser.email}`);
    console.log(`🔑 Nova senha: ${newPassword}`);
  } catch (error) {
    console.error("❌ Erro ao atualizar senha:", error);
    process.exit(1);
  } finally {
    await closeDb();
    process.exit(0);
  }
}

updateMasterPassword();
