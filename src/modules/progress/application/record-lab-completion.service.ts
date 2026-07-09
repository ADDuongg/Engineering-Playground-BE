import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CompleteLabResult,
  LAB_COMPLETED_EVENT,
  LabCompletedEvent,
} from '@db-play/types';
import { LabEntity } from '../entities/lab.entity';
import { UserLabCompletionRepository } from '../infrastructure/user-lab-completion.repository';

@Injectable()
export class RecordLabCompletionService {
  constructor(
    private readonly completionRepository: UserLabCompletionRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Idempotent completion write. Emits lab.completed only on first insert.
   * Does not enforce quiz gating — callers must gate before invoking.
   */
  async record(
    userId: string,
    lab: LabEntity,
  ): Promise<CompleteLabResult> {
    const completedAt = new Date();
    const { entity, created } =
      await this.completionRepository.createOrGetExisting({
        userId,
        labId: lab.id,
        completedAt,
      });

    if (created) {
      const event: LabCompletedEvent = {
        userId,
        labSlug: lab.slug,
        trackSlug: lab.track.slug,
        completedAt: entity.completedAt.toISOString(),
      };
      this.eventEmitter.emit(LAB_COMPLETED_EVENT, event);
    }

    return {
      labSlug: lab.slug,
      trackSlug: lab.track.slug,
      completedAt: entity.completedAt.toISOString(),
      alreadyCompleted: !created,
    };
  }
}
