import { ConfigService } from '@nestjs/config';
import { ErrorCode } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { BenchmarkProfileValidator } from './benchmark-profile.validator';

describe('BenchmarkProfileValidator', () => {
  let validator: BenchmarkProfileValidator;

  beforeEach(() => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'benchmark.allowedRps') {
          return [100, 500, 1000, 5000];
        }
        if (key === 'benchmark.allowedDurationSeconds') {
          return [10, 30, 60];
        }
        return undefined;
      }),
    } as unknown as ConfigService;

    validator = new BenchmarkProfileValidator(configService);
  });

  it('accepts supported profile combinations', () => {
    expect(
      validator.validate({ rps: 500, durationSeconds: 30 }),
    ).toEqual({ rps: 500, durationSeconds: 30 });
  });

  it('rejects unsupported RPS tiers', () => {
    expect(() => validator.validate({ rps: 300, durationSeconds: 10 }))
      .toThrow(DomainError);

    try {
      validator.validate({ rps: 300, durationSeconds: 10 });
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe(ErrorCode.VALIDATION_ERROR);
    }
  });

  it('rejects unsupported durations', () => {
    expect(() => validator.validate({ rps: 100, durationSeconds: 45 }))
      .toThrow(DomainError);
  });
});
