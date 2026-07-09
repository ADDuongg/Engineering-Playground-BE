import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { createSuccessResponse } from '@db-play/types';

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      requestId?: string;
      headers?: { accept?: string };
      url?: string;
      path?: string;
    }>();

    const accept = request.headers?.accept ?? '';
    const path = request.path ?? request.url ?? '';
    // SSE progress streams must not be wrapped in the JSON success envelope.
    if (
      accept.includes('text/event-stream') ||
      /\/benchmarks\/[^/]+\/progress(?:\?|$)/.test(path)
    ) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        if (
          data &&
          typeof data === 'object' &&
          'success' in data &&
          'data' in data
        ) {
          return data;
        }

        return createSuccessResponse(data ?? null, {
          requestId: request.requestId,
        });
      }),
    );
  }
}
