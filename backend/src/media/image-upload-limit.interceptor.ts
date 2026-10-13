import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { finalize, Observable } from 'rxjs';

@Injectable()
export class ImageUploadLimit implements NestInterceptor {
  private active = 0;

  public intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    if (this.active >= 3) {
      throw new HttpException(
        'Сервер занят обработкой изображений. Попробуйте чуть позже.',
        429,
      );
    }

    this.active += 1;

    return next.handle().pipe(
      finalize(() => {
        this.active -= 1;
      }),
    );
  }
}
