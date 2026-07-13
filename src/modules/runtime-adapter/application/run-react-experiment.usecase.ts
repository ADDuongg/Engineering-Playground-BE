import { Injectable, Logger } from '@nestjs/common';
import {
  ErrorCode,
  ReactExperimentInput,
  RunReactExperimentCommand,
  RuntimeAdapterType,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { ReactSandboxConfig } from '../config/react-sandbox.config';
import { ReactFixtureRegistry } from '../infrastructure/react-fixture.registry';
import { LabReactFixtureAllowlistService } from './lab-react-fixture-allowlist.service';
import { RunExperimentUseCase } from './run-experiment.usecase';

@Injectable()
export class RunReactExperimentUseCase {
  private readonly logger = new Logger(RunReactExperimentUseCase.name);

  constructor(
    private readonly allowlist: LabReactFixtureAllowlistService,
    private readonly fixtures: ReactFixtureRegistry,
    private readonly sandboxConfig: ReactSandboxConfig,
    private readonly runExperiment: RunExperimentUseCase,
  ) {}

  async execute(command: RunReactExperimentCommand) {
    const started = Date.now();
    const policy = this.sandboxConfig.getPolicy();
    const trackSlug = command.trackSlug ?? 'frontend-react';
    const requestId = command.requestId;

    this.logger.log({
      event: 'experiment_react_run',
      phase: 'started',
      requestId,
      userId: command.userId,
      labSlug: command.labSlug,
      fixtureId: command.fixtureId,
      action: command.action,
      trackSlug,
    });

    try {
      this.validateCommand(command, policy);

      if (!this.fixtures.has(command.fixtureId)) {
        throw new DomainError(
          ErrorCode.NOT_FOUND,
          `Unknown React fixture "${command.fixtureId}".`,
          404,
          { fixtureId: command.fixtureId },
        );
      }

      await this.allowlist.assertAllowed(command.labSlug, command.fixtureId);

      const input: ReactExperimentInput = {
        action: command.action,
        labSlug: command.labSlug,
        scenario: {
          scenarioId: command.fixtureId,
          fixtureId: command.fixtureId,
          props: command.props,
          interactions: command.interactions,
          options: command.options,
        },
      };

      const result = await this.withTimeout(
        this.runExperiment.execute({
          adapterType: RuntimeAdapterType.HEADLESS_REACT_SANDBOX,
          input,
          context: {
            requestId,
            trackSlug,
            labSlug: command.labSlug,
            userId: command.userId,
          },
        }),
        policy.timeoutMs,
      );

      this.logger.log({
        event: 'experiment_react_run',
        phase: 'completed',
        requestId,
        userId: command.userId,
        labSlug: command.labSlug,
        fixtureId: command.fixtureId,
        durationMs: Date.now() - started,
        metricCount: result.metrics.length,
      });

      return result;
    } catch (error) {
      this.logger.warn({
        event: 'experiment_react_run',
        phase: 'failed',
        requestId,
        userId: command.userId,
        labSlug: command.labSlug,
        fixtureId: command.fixtureId,
        durationMs: Date.now() - started,
        errorCode:
          error instanceof DomainError ? error.code : ErrorCode.INTERNAL_ERROR,
      });
      throw error;
    }
  }

  private validateCommand(
    command: RunReactExperimentCommand,
    policy: { maxInteractions: number; maxItems: number; policyVersion: string },
  ): void {
    if (!command.action?.trim()) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'action is required.',
        400,
      );
    }
    if (!command.fixtureId?.trim()) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'fixtureId is required.',
        400,
      );
    }
    if (!command.labSlug?.trim()) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'labSlug is required.',
        400,
      );
    }
    if (
      typeof command.componentSource === 'string' &&
      command.componentSource.trim().length > 0
    ) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Executable componentSource is not supported in MVP. Use a built-in fixtureId.',
        400,
        { reason: 'COMPONENT_SOURCE_FORBIDDEN' },
      );
    }

    const interactions = command.interactions ?? [];
    if (interactions.length > policy.maxInteractions) {
      throw new DomainError(
        ErrorCode.SANDBOX_ERROR,
        `Too many interactions (${interactions.length}). Max allowed is ${policy.maxInteractions}.`,
        403,
        {
          reason: 'RESOURCE_LIMIT',
          maxInteractions: policy.maxInteractions,
          policyVersion: policy.policyVersion,
          hint: 'Reduce the interaction sequence for this experiment step.',
        },
      );
    }

    const items = (command.props as { items?: unknown } | undefined)?.items;
    if (Array.isArray(items) && items.length > policy.maxItems) {
      throw new DomainError(
        ErrorCode.SANDBOX_ERROR,
        `Too many list items (${items.length}). Max allowed is ${policy.maxItems}.`,
        403,
        {
          reason: 'RESOURCE_LIMIT',
          maxItems: policy.maxItems,
          policyVersion: policy.policyVersion,
          hint: 'Use a smaller list for this lab scenario.',
        },
      );
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => {
            reject(
              new DomainError(
                ErrorCode.TIMEOUT,
                `React sandbox timed out after ${timeoutMs}ms.`,
                408,
                {
                  reason: 'REACT_SANDBOX_TIMEOUT',
                  timeoutMs,
                  hint: 'Simplify interactions or component work and try again.',
                },
              ),
            );
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}
