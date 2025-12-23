import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "crypto";
import Redis from "ioredis";

export interface SessionData {
  userId: string;
  role: string;
  schoolId: string | null;
  unitId: string | null;
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
  ): Promise<string> {
    const token = randomBytes(32).toString("hex");
    const sessionData: SessionData = {
      userId,
      role,
      schoolId,
      unitId,
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
