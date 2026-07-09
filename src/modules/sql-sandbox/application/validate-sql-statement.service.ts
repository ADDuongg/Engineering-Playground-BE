import { Injectable, Inject } from '@nestjs/common';
import {
  ErrorCode,
  SandboxViolationCode,
  SqlStatementKind,
  SqlValidationResult,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { findBlockedPattern } from '../domain/blocked-statement.rules';
import {
  classifyStatement,
  isAllowedStatementKind,
} from '../domain/statement-classifier';
import {
  DEFAULT_SANDBOX_CONFIG,
  SANDBOX_CONFIG,
  SandboxConfig,
} from '../config/sandbox.config';

const PLACEHOLDER_PATTERN = /\$(\d+)\b/g;
const UNSAFE_CONCAT_PATTERN = /'\s*\|\||\|\|\s*'/;

@Injectable()
export class ValidateSqlStatementService {
  constructor(
    @Inject(SANDBOX_CONFIG)
    private readonly config: SandboxConfig = DEFAULT_SANDBOX_CONFIG,
  ) {}

  validate(sql: string, parameters: unknown[]): SqlValidationResult {
    const trimmed = sql?.trim() ?? '';

    if (!trimmed) {
      this.throwSandboxError(
        SandboxViolationCode.EMPTY_SQL,
        'SQL statement cannot be empty.',
        'Provide a valid SQL statement to run in the playground.',
      );
    }

    if (!Array.isArray(parameters)) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Query parameters must be provided as an array.',
        400,
        { policyVersion: this.config.policyVersion },
      );
    }

    const blocked = findBlockedPattern(trimmed);
    if (blocked) {
      this.throwSandboxError(
        SandboxViolationCode.BLOCKED_PATTERN,
        blocked.message,
        blocked.hint,
      );
    }

    if (UNSAFE_CONCAT_PATTERN.test(trimmed)) {
      this.throwSandboxError(
        SandboxViolationCode.NON_PARAMETERIZED,
        'String concatenation in SQL is not allowed. Use parameterized placeholders ($1, $2, …) instead.',
        'Replace inline string building with bound parameters to keep queries safe and predictable.',
      );
    }

    this.assertPlaceholderCoverage(trimmed, parameters);

    let classified;
    try {
      classified = classifyStatement(trimmed);
    } catch (error) {
      this.handleClassificationError(error);
    }

    if (
      !isAllowedStatementKind(
        classified.statementKind,
        this.config.allowedStatementKinds,
      )
    ) {
      this.throwSandboxError(
        SandboxViolationCode.DISALLOWED_STATEMENT,
        `Statement type "${classified.statementKind}" is not allowed in the playground sandbox.`,
        'This lab only supports read queries, EXPLAIN, and index operations on playground tables.',
      );
    }

    return {
      valid: true,
      normalizedSql: classified.normalizedSql,
      statementKind: classified.statementKind,
    };
  }

  private assertPlaceholderCoverage(sql: string, parameters: unknown[]): void {
    const matches = [...sql.matchAll(PLACEHOLDER_PATTERN)];
    if (matches.length === 0) {
      return;
    }

    const maxIndex = Math.max(
      ...matches.map((match) => parseInt(match[1] ?? '0', 10)),
    );

    if (maxIndex > parameters.length) {
      this.throwSandboxError(
        SandboxViolationCode.NON_PARAMETERIZED,
        `SQL references $${maxIndex} but only ${parameters.length} parameter(s) were provided.`,
        'Ensure every placeholder ($1, $2, …) has a matching value in the parameters array.',
      );
    }
  }

  private handleClassificationError(error: unknown): never {
    if (error instanceof Error) {
      if (error.message === 'EMPTY_SQL') {
        this.throwSandboxError(
          SandboxViolationCode.EMPTY_SQL,
          'SQL statement cannot be empty.',
          'Provide a valid SQL statement to run in the playground.',
        );
      }

      if (error.message === 'MULTI_STATEMENT') {
        this.throwSandboxError(
          SandboxViolationCode.MULTI_STATEMENT,
          'Only one SQL statement can be executed at a time.',
          'Split multiple statements into separate runs.',
        );
      }

      if (error.message.startsWith('DISALLOWED:')) {
        const rawType = error.message.replace('DISALLOWED:', '');
        this.throwSandboxError(
          SandboxViolationCode.DISALLOWED_STATEMENT,
          `Statement type "${rawType}" is not allowed in the playground sandbox.`,
          'This lab only supports read queries, EXPLAIN, and index operations on playground tables.',
        );
      }
    }

    this.throwSandboxError(
      SandboxViolationCode.DISALLOWED_STATEMENT,
      'The SQL statement could not be validated for sandbox execution.',
      'Check syntax and ensure the statement is supported by this lab.',
    );
  }

  private throwSandboxError(
    violationCode: SandboxViolationCode,
    message: string,
    hint: string,
  ): never {
    throw new DomainError(ErrorCode.SANDBOX_ERROR, message, 403, {
      violationCode,
      hint,
      policyVersion: this.config.policyVersion,
    });
  }
}
