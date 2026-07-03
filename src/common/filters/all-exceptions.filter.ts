import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ErrorCode } from '@db-play/types';
import { DomainError } from '../errors/domain.error';

@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    response.status(exception.statusCode).json({
      success: false,
      data: null,
      meta: {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      },
      error: {
        code: exception.code,
        message: exception.message,
        details: exception.details,
      },
    });
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = ErrorCode.INTERNAL_ERROR;
    let message = 'An unexpected error occurred';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp.message as string) ?? message;
        details = resp;
      }
      code = this.mapHttpStatusToErrorCode(status);
    }

    response.status(status).json({
      success: false,
      data: null,
      meta: {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      },
      error: {
        code,
        message: Array.isArray(message) ? message.join(', ') : message,
        details,
      },
    });
  }

  private mapHttpStatusToErrorCode(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_ERROR;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.CONFLICT;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.RATE_LIMITED;
      case HttpStatus.REQUEST_TIMEOUT:
        return ErrorCode.TIMEOUT;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }
}
