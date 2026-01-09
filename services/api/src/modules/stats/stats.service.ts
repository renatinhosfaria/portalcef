import { eq, getDb } from "@essencia/db";
import { users as usersTable } from "@essencia/db/schema";
import { Injectable } from "@nestjs/common";
import { SessionService } from "../auth/session.service";

@Injectable()
export class StatsService {
  constructor(private sessionService: SessionService) {}

  async getDashboard() {
    // Try cache first
    const cacheKey = "stats:dashboard";
    try {
      const cached = await this.sessionService.getCachedJson(cacheKey);
      if (cached) return cached;
    } catch (err) {
      console.warn("Warning: failed to read stats cache", err);
      // continue without cache
    }

    const db = getDb();

    // Fetch lightweight user list and compute counts in memory (safe for typical sizes)
    type UserRoleRow = { id: string; role: string };

    const users: UserRoleRow[] = await db.query.users.findMany({
      columns: { id: true, role: true },
    });

    const totalUsers = users.length;

    const adminRoles = [
      "master",
      "diretora_geral",
      "gerente_unidade",
      "gerente_financeiro",
    ];
    const administrators = users.filter((u) =>
      adminRoles.includes(u.role),
    ).length;

    // Defensive calls to Redis-backed session methods: if Redis is down, return safe defaults
    let sessions24h = 0;
    let activeNow = 0;
    try {
      sessions24h = await this.sessionService.countActiveSessions();
    } catch (err) {
      console.warn("Warning: failed to count active sessions", err);
      sessions24h = 0;
    }
    try {
      activeNow = await this.sessionService.countActiveUsers();
    } catch (err) {
      console.warn("Warning: failed to count active users", err);
      activeNow = 0;
    }

    const payload = {
      totalUsers,
      activeNow,
      administrators,
      sessions24h,
    };

    // Cache for short period to reduce DB/Redis load
    try {
      await this.sessionService.setCachedJson(cacheKey, payload, 15);
    } catch (err) {
      console.warn("Warning: failed to write stats cache", err);
      // ignore cache errors
    }

    return payload;
  }

  async getMasterOverview() {
    // Try cache first
    const cacheKey = "stats:master-overview";
    try {
      const cached = await this.sessionService.getCachedJson(cacheKey);
      if (cached) return cached;
    } catch (err) {
      console.warn("Warning: failed to read master overview cache", err);
    }

    const db = getDb();

    // Fetch counts in parallel
    const [schools, units, directors] = await Promise.all([
      db.query.schools.findMany({ columns: { id: true } }),
      db.query.units.findMany({ columns: { id: true } }),
      db.query.users.findMany({
        columns: { id: true },
        where: eq(usersTable.role, "diretora_geral"),
      }),
    ]);

    const payload = {
      schoolsCount: schools.length,
      unitsCount: units.length,
      directorsCount: directors.length,
      studentsCount: 0, // Placeholder for future implementation
    };

    // Cache for 30 seconds to reduce DB load
    try {
      await this.sessionService.setCachedJson(cacheKey, payload, 30);
    } catch (err) {
      console.warn("Warning: failed to write master overview cache", err);
    }

    return payload;
  }
}
