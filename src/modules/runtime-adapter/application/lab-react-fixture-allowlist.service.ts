import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { LabGuidedStepRepository } from '../../labs/infrastructure/lab-guided-step.repository';

@Injectable()
export class LabReactFixtureAllowlistService {
  constructor(
    private readonly labRepository: LabRepository,
    private readonly stepRepository: LabGuidedStepRepository,
  ) {}

  async getAllowedFixtureIds(labSlug: string): Promise<Set<string>> {
    const lab = await this.labRepository.findBySlug(labSlug);
    if (!lab) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Lab "${labSlug}" was not found.`,
        404,
      );
    }

    const steps = await this.stepRepository.findOrderedByLabId(lab.id);
    const ids = new Set<string>();
    for (const step of steps) {
      const payload = step.payload;
      if (!payload || typeof payload !== 'object') {
        continue;
      }
      const reactScenario = (payload as { reactScenario?: unknown })
        .reactScenario;
      if (!reactScenario || typeof reactScenario !== 'object') {
        continue;
      }
      const scenarioId = (reactScenario as { scenarioId?: unknown }).scenarioId;
      if (typeof scenarioId === 'string' && scenarioId.trim().length > 0) {
        ids.add(scenarioId.trim());
      }
    }
    return ids;
  }

  async assertAllowed(labSlug: string, fixtureId: string): Promise<void> {
    const allowed = await this.getAllowedFixtureIds(labSlug);
    if (!allowed.has(fixtureId)) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        `Fixture "${fixtureId}" is not allowlisted for lab "${labSlug}".`,
        403,
        {
          reason: 'FIXTURE_NOT_ALLOWED_FOR_LAB',
          labSlug,
          fixtureId,
          hint: 'This fixture belongs to another lab. Use a scenario from this lab’s guided steps.',
        },
      );
    }
  }
}
