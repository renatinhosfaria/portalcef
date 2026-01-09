import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "crypto";
import Redis from "ioredis";

export interface SessionData {
  userId: string;
  role: string;
  schoolId: string | null;
  unitId: string | null;
  stageId: string | null;
  createdAt: number;
}

@Injectable()
export class SessionService implements OnModuleDestroy {
  private redis: Redis;
  private readonly ttlSeconds: number;
  private readonly renewalThreshold: number;

  constructor(private configService: ConfigService) {
    const redisUrl =
      this.configService.get<string>("REDIS_URL") ?? "redis://localhost:6379";
    this.redis = new Redis(redisUrl);

    // Session TTL in seconds (default 24 hours)
    const ttlHours = this.configService.get<number>("SESSION_TTL_HOURS") ?? 24;
    this.ttlSeconds = ttlHours * 60 * 60;

    // Renewal threshold (default 25% = 6 hours for 24h TTL)
    this.renewalThreshold =
      this.configService.get<number>("SESSION_RENEWAL_THRESHOLD") ?? 0.25;
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  /**
   * Create a new session for a user with tenant context
   */
  async createSession(
    userId: string,
    role: string,
    schoolId: string | null,
    unitId: string | null,
    stageId: string | null,
  ): Promise<string> {
    const token = randomBytes(32).toString("hex");
    const sessionData: SessionData = {
      userId,
      role,
      schoolId,
      unitId,
      stageId,
      createdAt: Date.now(),
    };

    await this.redis.setex(
      this.getSessionKey(token),
      this.ttlSeconds,
      JSON.stringify(sessionData),
    );

    // Also store user -> session mapping for global logout
    await this.redis.sadd(this.getUserSessionsKey(userId), token);

    return token;
  }

  /**
   * Get session data and renew if needed (sliding window)
   */
  async getSession(token: string): Promise<SessionData | null> {
    const key = this.getSessionKey(token);
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    // Check TTL for sliding window renewal
    const ttl = await this.redis.ttl(key);
    const thresholdSeconds = this.ttlSeconds * this.renewalThreshold;

    // Renew if TTL is below threshold
    if (ttl < thresholdSeconds) {
      await this.redis.expire(key, this.ttlSeconds);
      this.logSessionRenewal(token);
    }

    return JSON.parse(data) as SessionData;
  }

  /**
   * Delete a specific session (logout)
   */
  async deleteSession(token: string): Promise<void> {
    const session = await this.getSession(token);
    if (session) {
      await this.redis.del(this.getSessionKey(token));
      await this.redis.srem(this.getUserSessionsKey(session.userId), token);
    }
  }

  /**
   * Delete all sessions for a user (global logout)
   */
  async deleteAllUserSessions(userId: string): Promise<void> {
    const tokens = await this.redis.smembers(this.getUserSessionsKey(userId));

    if (tokens.length > 0) {
      const sessionKeys = tokens.map((t) => this.getSessionKey(t));
      await this.redis.del(...sessionKeys);
      await this.redis.del(this.getUserSessionsKey(userId));
    }
  }

  private getSessionKey(token: string): string {
    return `session:${token}`;
  }

  private getUserSessionsKey(userId: string): string {
    return `user_sessions:${userId}`;
  }

  /**
   * Count total active session keys (session:*)
   */
  async countActiveSessions(): Promise<number> {
    let cursor = "0";
    let total = 0;
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        "MATCH",
        "session:*",
        "COUNT",
        1000,
      );
      cursor = nextCursor as string;
      total += keys.length;
    } while (cursor !== "0");
    return total;
  }

  /**
   * Count number of users that currently have at least one session (user_sessions:*)
   */
  async countActiveUsers(): Promise<number> {
    let cursor = "0";
    let usersWithSessions = 0;
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        "MATCH",
        "user_sessions:*",
        "COUNT",
        1000,
      );
      cursor = nextCursor as string;
      if (keys.length > 0) {
        const pipeline = this.redis.pipeline();
        keys.forEach((k) => pipeline.scard(k));
        const results = await pipeline.exec();
        // results: [ [null, scardValue], ... ] or null
        if (!results) continue;
        for (const r of results as [Error | null, number | null][]) {
          const val = r[1];
          if (typeof val === "number" && val > 0) usersWithSessions += 1;
        }
      }
    } while (cursor !== "0");
    return usersWithSessions;
  }

  /**
   * Get a JSON value from redis cache
   */
  async getCachedJson<T = unknown>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  /**
   * Set JSON value in redis cache with TTL seconds
   */
  async setCachedJson(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
  }

  /**
   * Simple per-key rate limiter using INCR + EXPIRE
   * returns { allowed, remaining }
   */
  async rateLimit(
    key: string,
    windowSeconds: number,
    limit: number,
  ): Promise<{ allowed: boolean; remaining: number }> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, windowSeconds);
    }
    const allowed = count <= limit;
    const remaining = allowed ? Math.max(0, limit - count) : 0;
    return { allowed, remaining };
  }

  /**
   * Log session renewal with safe hash (observability)
   */
  private logSessionRenewal(token: string): void {
    const safeHash = createHash("sha256")
      .update(token)
      .digest("hex")
      .slice(0, 10);
    console.log(`Session renewed: ${safeHash}`);
  }
}
