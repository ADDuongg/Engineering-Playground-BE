import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DatasetPreparationStatus,
  DatasetReadinessStatus,
  DatasetTier,
} from '@db-play/types';
import { RedisService } from '../../../common/services/redis.service';

@Injectable()
export class DatasetPreparationStatusStore {
  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  buildKey(
    family: string,
    version: string,
    tier: DatasetTier,
    sessionId?: string,
  ): string {
    if (sessionId) {
      return `dataset:prep:${sessionId}:${family}:${version}:${tier}`;
    }

    return `dataset:prep:${family}:${version}:${tier}`;
  }

  async get(
    family: string,
    version: string,
    tier: DatasetTier,
    sessionId?: string,
  ): Promise<DatasetPreparationStatus | null> {
    const raw = await this.redisService
      .getClient()
      .get(this.buildKey(family, version, tier, sessionId));

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as DatasetPreparationStatus;
  }

  async save(
    status: DatasetPreparationStatus,
    sessionId?: string,
  ): Promise<void> {
    const ttl = this.configService.get<number>(
      'dataset.preparationTtlSeconds',
      3600,
    );

    await this.redisService
      .getClient()
      .set(
        this.buildKey(status.family, status.version, status.tier, sessionId),
        JSON.stringify(status),
        'EX',
        ttl,
      );
  }

  async getOrDefault(
    family: string,
    version: string,
    tier: DatasetTier,
    sessionId?: string,
  ): Promise<DatasetPreparationStatus> {
    const existing = await this.get(family, version, tier, sessionId);

    if (existing) {
      return existing;
    }

    return {
      family,
      version,
      tier,
      status: DatasetReadinessStatus.NOT_STARTED,
      completedAt: null,
      durationMs: null,
      error: null,
    };
  }

  async markPreparing(
    family: string,
    version: string,
    tier: DatasetTier,
    sessionId?: string,
  ): Promise<DatasetPreparationStatus> {
    const status: DatasetPreparationStatus = {
      family,
      version,
      tier,
      status: DatasetReadinessStatus.PREPARING,
      startedAt: new Date().toISOString(),
      completedAt: null,
      durationMs: null,
      error: null,
    };
    await this.save(status, sessionId);
    return status;
  }

  async markResetting(
    family: string,
    version: string,
    tier: DatasetTier,
    sessionId?: string,
  ): Promise<DatasetPreparationStatus> {
    const status: DatasetPreparationStatus = {
      family,
      version,
      tier,
      status: DatasetReadinessStatus.RESETTING,
      startedAt: new Date().toISOString(),
      completedAt: null,
      durationMs: null,
      error: null,
    };
    await this.save(status, sessionId);
    return status;
  }

  async markReady(
    family: string,
    version: string,
    tier: DatasetTier,
    startedAt: string,
    durationMs: number,
    sessionId?: string,
  ): Promise<DatasetPreparationStatus> {
    const status: DatasetPreparationStatus = {
      family,
      version,
      tier,
      status: DatasetReadinessStatus.READY,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs,
      error: null,
    };
    await this.save(status, sessionId);
    return status;
  }

  async markFailed(
    family: string,
    version: string,
    tier: DatasetTier,
    startedAt: string,
    error: DatasetPreparationStatus['error'],
    sessionId?: string,
  ): Promise<DatasetPreparationStatus> {
    const status: DatasetPreparationStatus = {
      family,
      version,
      tier,
      status: DatasetReadinessStatus.FAILED,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - new Date(startedAt).getTime(),
      error,
    };
    await this.save(status, sessionId);
    return status;
  }
}
