import { ErrorCode } from '@db-play/types';

export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
