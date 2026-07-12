import { ErrorCode } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';

export interface AnswerKeyOptionLike {
  isCorrect: boolean;
}

/**
 * Enforces single-select invariants: ≥2 options and exactly one correct.
 */
export function assertValidAnswerKey(
  options: AnswerKeyOptionLike[],
  field = 'options',
): void {
  if (options.length < 2) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'A single-select question must have at least two options.',
      400,
      { field },
    );
  }

  const correctCount = options.filter((option) => option.isCorrect).length;
  if (correctCount !== 1) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'A single-select question must have exactly one correct option.',
      400,
      { field, correctCount },
    );
  }
}
