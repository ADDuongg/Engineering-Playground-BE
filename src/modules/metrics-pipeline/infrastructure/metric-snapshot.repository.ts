import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { MetricContract, MetricRunContext, MetricRunType } from '@db-play/types';
import { MetricSnapshotEntity } from './metric-snapshot.entity';

export interface SaveMetricSnapshotInput {
  context: MetricRunContext;
  metrics: MetricContract[];
  omittedMetricKeys?: string[];
}

@Injectable()
export class MetricSnapshotRepository {
  constructor(
    @InjectRepository(MetricSnapshotEntity, 'platform')
    private readonly repository: Repository<MetricSnapshotEntity>,
  ) {}

  async saveSnapshot(input: SaveMetricSnapshotInput): Promise<MetricSnapshotEntity> {
    if (input.context.jobId) {
      const existing = await this.findByJobId(input.context.jobId);
      if (existing) {
        return existing;
      }
    }

    const entity = this.repository.create({
      sessionId: input.context.sessionId!,
      labSlug: input.context.labSlug,
      trackSlug: input.context.trackSlug,
      runType: input.context.runType,
      datasetFamily: input.context.dataset.family,
      datasetTier: input.context.dataset.tier,
      datasetVersion: input.context.dataset.version,
      metrics: input.metrics,
      omittedMetricKeys: input.omittedMetricKeys,
      requestId: input.context.requestId,
      jobId: input.context.jobId ?? null,
      profile: input.context.profile ?? null,
    });

    try {
      return await this.repository.save(entity);
    } catch (error) {
      const driverCode =
        error instanceof QueryFailedError
          ? String(
              (error.driverError as { code?: string } | undefined)?.code ?? '',
            )
          : '';
      if (input.context.jobId && driverCode === '23505') {
        const existing = await this.findByJobId(input.context.jobId);
        if (existing) {
          return existing;
        }
      }
      throw error;
    }
  }

  async findByJobId(jobId: string): Promise<MetricSnapshotEntity | null> {
    return this.repository.findOne({ where: { jobId } });
  }

  async findHistory(
    sessionId: string,
    labSlug: string | undefined,
    limit: number,
    runType?: MetricRunType,
  ): Promise<MetricSnapshotEntity[]> {
    const query = this.repository
      .createQueryBuilder('snapshot')
      .where('snapshot.session_id = :sessionId', { sessionId })
      .orderBy('snapshot.created_at', 'ASC')
      .take(limit);

    if (labSlug) {
      query.andWhere('snapshot.lab_slug = :labSlug', { labSlug });
    }

    if (runType) {
      query.andWhere('snapshot.run_type = :runType', { runType });
    }

    return query.getMany();
  }

  async pruneRetention(
    sessionId: string,
    labSlug: string | undefined,
    retentionLimit: number,
  ): Promise<void> {
    const query = this.repository
      .createQueryBuilder('snapshot')
      .select('snapshot.id', 'id')
      .where('snapshot.session_id = :sessionId', { sessionId })
      .orderBy('snapshot.created_at', 'DESC');

    if (labSlug) {
      query.andWhere('snapshot.lab_slug = :labSlug', { labSlug });
    }

    const rows = await query.getRawMany<{ id: string }>();

    if (rows.length <= retentionLimit) {
      return;
    }

    const idsToDelete = rows.slice(retentionLimit).map((row) => row.id);

    await this.repository.delete(idsToDelete);
  }
}
