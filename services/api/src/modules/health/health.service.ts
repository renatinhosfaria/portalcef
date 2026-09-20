import { sql } from "@essencia/db";
import { Injectable, Logger } from "@nestjs/common";

import { DatabaseService } from "../../common/database/database.service";
import { SessionService } from "../auth/session.service";

export type HealthDependencyStatus = "connected" | "disconnected";
export type HealthStatus = "ok" | "degraded" | "unhealthy";

export interface HealthResult {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  database: HealthDependencyStatus;
  redis: HealthDependencyStatus;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly timeoutMs = 2_000;

  constructor(
    private readonly database: DatabaseService,
    private readonly sessionService: SessionService,
  ) {}

  async check(): Promise<HealthResult> {
    const [database, redis] = await Promise.all([
      this.checkDependency("database", () =>
        this.database.db.execute(sql`SELECT 1`),
      ),
      this.checkDependency("redis", () => this.sessionService.ping()),
    ]);

    const conectados = [database, redis].filter(
      (status) => status === "connected",
    ).length;
    const status: HealthStatus =
      conectados === 2 ? "ok" : conectados === 0 ? "unhealthy" : "degraded";

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      database,
      redis,
    };
  }

  private async checkDependency(
    dependency: "database" | "redis",
    check: () => Promise<unknown>,
  ): Promise<HealthDependencyStatus> {
    try {
      await this.withTimeout(check());
      return "connected";
    } catch {
      this.logger.warn(`Falha no health check de ${dependency}`);
      return "disconnected";
    }
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("health check timeout")),
        this.timeoutMs,
      );
    });

    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
