import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExperimentSession } from '@db-play/types';
import { RedisService } from '../../../common/services/redis.service';

@Injectable()
export class ExperimentSessionStore {
  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  buildSessionKey(sessionId: string): string {
    return `experiment:session:${sessionId}`;
  }

  buildLookupKey(
    clientSessionToken: string,
    trackSlug: string,
    labSlug: string,
  ): string {
    return `experiment:session:lookup:${clientSessionToken}:${trackSlug}:${labSlug}`;
  }

  private ttlSeconds(): number {
    return this.configService.get<number>(
      'experiment.sessionIdleTtlSeconds',
      3600,
    );
  }

  async save(session: ExperimentSession): Promise<void> {
    const ttl = this.ttlSeconds();
    const client = this.redisService.getClient();

    await client.set(
      this.buildSessionKey(session.sessionId),
      JSON.stringify(session),
      'EX',
      ttl,
    );

    await client.set(
      this.buildLookupKey(
        session.clientSessionToken,
        session.trackSlug,
        session.labSlug,
      ),
      session.sessionId,
      'EX',
      ttl,
    );
  }

  async getById(sessionId: string): Promise<ExperimentSession | null> {
    const raw = await this.redisService
      .getClient()
      .get(this.buildSessionKey(sessionId));

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as ExperimentSession;
  }

  async findByLookup(
    clientSessionToken: string,
    trackSlug: string,
    labSlug: string,
  ): Promise<ExperimentSession | null> {
    const sessionId = await this.redisService
      .getClient()
      .get(this.buildLookupKey(clientSessionToken, trackSlug, labSlug));

    if (!sessionId) {
      return null;
    }

    return this.getById(sessionId);
  }

  async delete(session: ExperimentSession): Promise<void> {
    const client = this.redisService.getClient();
    await client.del(this.buildSessionKey(session.sessionId));
    await client.del(
      this.buildLookupKey(
        session.clientSessionToken,
        session.trackSlug,
        session.labSlug,
      ),
    );
  }

  async touchActivity(session: ExperimentSession): Promise<ExperimentSession> {
    const now = new Date().toISOString();
    const ttl = this.ttlSeconds();
    const updated: ExperimentSession = {
      ...session,
      lastActivityAt: now,
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    };

    await this.save(updated);
    return updated;
  }
}
