import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  public catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    let message: string | string[] =
      exception instanceof HttpException
        ? exception.message
        : 'Internal Server Error';

    if (exception instanceof HttpException) {
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        message = payload;
      } else if (
        payload &&
        typeof payload === 'object' &&
        'message' in payload
      ) {
        const candidate: unknown = payload.message;

        if (
          typeof candidate === 'string' ||
          (Array.isArray(candidate) &&
            candidate.every((item: unknown) => typeof item === 'string'))
        ) {
          message = candidate;
        }
      }
    } else if (exception instanceof PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = 409;
        message = 'Такая запись уже существует';
      } else if (exception.code === 'P2025') {
        status = 404;
        message = 'Запись не найдена';
      } else if (exception.code === 'P2003') {
        status = 400;
        message = 'Связанная запись не найдена или используется';
      }
    }

    if (status >= 500) {
      // Сообщение Prisma может содержать пользовательские данные из запроса.
      this.logger.error(
        `Unhandled API error: ${exception instanceof Error ? exception.name : 'Unknown error'}`,
      );
    }

    response.status(status).json({
      status,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: ctx.getRequest<Request>().url.split('?')[0],
    });
  }
}
