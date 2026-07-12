import { ErrorCode } from '@db-play/types';
import { assertValidAnswerKey } from './quiz-answer-key.validator';

describe('assertValidAnswerKey', () => {
  it('accepts two options with exactly one correct', () => {
    expect(() =>
      assertValidAnswerKey([{ isCorrect: true }, { isCorrect: false }]),
    ).not.toThrow();
  });

  it('rejects fewer than two options', () => {
    expect(() => assertValidAnswerKey([{ isCorrect: true }])).toThrow(
      expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }),
    );
  });

  it('rejects zero or multiple correct options', () => {
    expect(() =>
      assertValidAnswerKey([{ isCorrect: false }, { isCorrect: false }]),
    ).toThrow(expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }));

    expect(() =>
      assertValidAnswerKey([{ isCorrect: true }, { isCorrect: true }]),
    ).toThrow(expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }));
  });
});
