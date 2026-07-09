import { Injectable } from '@nestjs/common';
import { ErrorCode, ExperimentSession } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { ExperimentSessionStore } from '../infrastructure/experiment-session.store';

@Injectable()
export class GetExperimentSessionUseCase {
  constructor(private readonly sessionStore: ExperimentSessionStore) {}

  async execute(sessionId: string): Promise<ExperimentSession> {
    const session = await this.sessionStore.getById(sessionId);

    if (!session) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        'Experiment session is not available or has expired.',
        404,
        {
          reason: 'SESSION_NOT_FOUND',
          hint: 'Open the lab again to start a new experiment session.',
        },
      );
    }

    return session;
  }
}
