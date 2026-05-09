import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '../../generated/prisma/enums';

@Injectable()
export class AdminGuard implements CanActivate {
  public canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<{
      user?: { role?: (typeof UserRole)[keyof typeof UserRole] };
    }>().user;

    if (user?.role === UserRole.ADMIN) {
      return true;
    }

    throw new ForbiddenException('Требуются права администратора');
  }
}
