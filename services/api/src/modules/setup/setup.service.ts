import { getDb, schools, units, users } from "@essencia/db";
import { Injectable } from "@nestjs/common";
import * as bcrypt from "bcrypt";

export interface InitialSetupData {
  schoolName: string;
  schoolCode: string;
  unitName: string;
  unitCode: string;
  unitAddress: string;
  masterEmail: string;
  masterPassword: string;
  masterName: string;
}

@Injectable()
export class SetupService {
  private db = getDb();

  /**
   * Verifica se o sistema já foi inicializado (se existe algum usuário)
   */
  async isInitialized(): Promise<boolean> {
    const existingUsers = await this.db.select().from(users).limit(1);
    return existingUsers.length > 0;
  }

  /**
   * Cria os dados iniciais do sistema: escola, unidade e usuário master
   * Só funciona se o banco estiver vazio (segurança)
   */
  async initialize(data: InitialSetupData) {
    // Verificar se já foi inicializado
    const alreadyInitialized = await this.isInitialized();
    if (alreadyInitialized) {
      throw new Error("Sistema já foi inicializado");
    }

    // Hash da senha
    const passwordHash = await bcrypt.hash(data.masterPassword, 10);

    // Criar escola
    const [school] = await this.db
      .insert(schools)
      .values({
        name: data.schoolName,
        code: data.schoolCode,
      })
      .returning();

    // Criar unidade
    const [unit] = await this.db
      .insert(units)
      .values({
        schoolId: school.id,
        name: data.unitName,
        code: data.unitCode,
        address: data.unitAddress,
      })
      .returning();

    // Criar usuário master
    const [user] = await this.db
      .insert(users)
      .values({
        email: data.masterEmail,
        passwordHash,
        name: data.masterName,
        role: "master",
        schoolId: null,
        unitId: null,
        stageId: null,
      })
      .returning();

    return {
      school,
      unit,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  /**
   * Reseta o sistema (CUIDADO: apaga todos os dados)
   * Apenas para desenvolvimento
   */
  async reset() {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Reset não permitido em produção");
    }

    // Delete em ordem para respeitar foreign keys
    await this.db.delete(users);
    await this.db.delete(units);
    await this.db.delete(schools);

    return { success: true };
  }
}
