import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { JwtPayload } from '../decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.isPublicRoute(context);

    if (isPublic) {
      // Still run JWT strategy when a Bearer token is present so req.user is
      // populated on optional-auth public routes (benchmarks, experiments, …).
      return super.canActivate(context);
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = JwtPayload>(
    err: Error | null,
    user: TUser | false,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (this.isPublicRoute(context)) {
      if (err || !user) {
        return undefined as TUser;
      }

      return user;
    }

    if (err || !user) {
      throw err ?? new UnauthorizedException();
    }

    return user;
  }

  private isPublicRoute(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false
    );
  }
}
