import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorCode, BenchmarkProfile } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';

@Injectable()
export class BenchmarkProfileValidator {
  constructor(private readonly configService: ConfigService) {}

  validate(profile: BenchmarkProfile): BenchmarkProfile {
    const allowedRps =
      this.configService.get<number[]>('benchmark.allowedRps') ?? [
        100, 500, 1000, 5000,
      ];
    const allowedDurations =
      this.configService.get<number[]>('benchmark.allowedDurationSeconds') ?? [
        10, 30, 60,
      ];

    if (!allowedRps.includes(profile.rps)) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        `Unsupported benchmark RPS tier: ${profile.rps}.`,
        400,
        {
          reason: 'INVALID_BENCHMARK_RPS',
          allowedRps,
          hint: `Choose one of the supported load tiers: ${allowedRps.join(', ')} requests per second.`,
        },
      );
    }

    if (!allowedDurations.includes(profile.durationSeconds)) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        `Unsupported benchmark duration: ${profile.durationSeconds}s.`,
        400,
        {
          reason: 'INVALID_BENCHMARK_DURATION',
          allowedDurationSeconds: allowedDurations,
          hint: `Choose one of the supported durations: ${allowedDurations.join(', ')} seconds.`,
        },
      );
    }

    return profile;
  }
}
