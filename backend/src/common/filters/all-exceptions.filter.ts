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
      if (typeof payload === 'string') message = payload;
      else if ('message' in payload)
        message = payload.message as string | string[];
    } else if (exception instanceof PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = 409;
        message = 'Такая запись уже существует';
      } else if (exception.code === 'P2025') {
        status = 404;
        message = 'Запись не найдена';
      }
    }

    if (status >= 500)
      this.logger.error(
        'Unhandled API error',
        exception instanceof Error ? exception.stack : undefined,
      );

    response.status(status).json({
      status,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: ctx.getRequest<Request>().url,
    });
  }
}
