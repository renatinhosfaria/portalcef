import { eq, getDb } from "@essencia/db";
import { users } from "@essencia/db/schema";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcrypt";

import { SessionService, type SessionData } from "./session.service";

interface LoginResult {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    schoolId: string | null;
    unitId: string | null;
    stageId: string | null;
  };
}

@Injectable()
export class AuthService {
  constructor(private sessionService: SessionService) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const db = getDb();

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      throw new UnauthorizedException("Credenciais invalidas");
    }

    // Verify password with bcrypt
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedException("Credenciais invalidas");
    }

    // Create session with tenant context
    const token = await this.sessionService.createSession(
      user.id,
      user.role,
      user.schoolId,
      user.unitId,
      user.stageId,
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        schoolId: user.schoolId,
        unitId: user.unitId,
        stageId: user.stageId,
      },
    };
  }

  async logout(token: string): Promise<void> {
    await this.sessionService.deleteSession(token);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.sessionService.deleteAllUserSessions(userId);
  }

  async validateSession(token: string): Promise<SessionData> {
    const session = await this.sessionService.getSession(token);

    if (!session) {
      throw new UnauthorizedException("Sessao expirada");
    }

    return session;
  }

  async getCurrentUser(token: string) {
    const session = await this.validateSession(token);
    const db = getDb();

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: {
        id: true,
        email: true,
        name: true,
        role: true,
        schoolId: true,
        unitId: true,
        stageId: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("Usuario nao encontrado");
    }

    return user;
  }

  /**
   * Hash a password using bcrypt
   * Use this when creating or updating user passwords
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }
}
