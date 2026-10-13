import {
  BadRequestException,
  HttpException,
  type ArgumentsHost,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('Ошибки API без внутренних данных', () => {
  let status: number;
  let body: Record<string, unknown>;
  let host: ArgumentsHost;
  beforeEach(() => {
    const response = {
      status: (value: number) => {
        status = value;
        return response;
      },
      json: (value: Record<string, unknown>) => {
        body = value;
      },
    };
    host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({ url: '/movies' }),
      }),
    } as ArgumentsHost;
  });

  it('возвращает 409 для конфликтующей записи без текста SQL', () => {
    const error = new PrismaClientKnownRequestError(
      'internal database details',
      { code: 'P2002', clientVersion: 'test' },
    );
    new AllExceptionsFilter().catch(error, host);
    expect(status).toBe(409);
    expect(JSON.stringify(body)).not.toContain('internal database details');
  });

  it('сохраняет сообщения валидации по полям', () => {
    new AllExceptionsFilter().catch(
      new BadRequestException(['Введите название', 'Введите описание']),
      host,
    );
    expect(status).toBe(400);
    expect(body.message).toEqual(['Введите название', 'Введите описание']);
  });

  it('обрабатывает пустой payload исключения без второй ошибки', () => {
    expect(() =>
      new AllExceptionsFilter().catch(
        new HttpException(null as never, 400),
        host,
      ),
    ).not.toThrow();
    expect(status).toBe(400);
    expect(typeof body.message).toBe('string');
  });

  it('возвращает 400 при отсутствии связанной записи вместо 500', () => {
    new AllExceptionsFilter().catch(
      new PrismaClientKnownRequestError('private SQL', {
        code: 'P2003',
        clientVersion: 'test',
      }),
      host,
    );
    expect(status).toBe(400);
    expect(JSON.stringify(body)).not.toContain('private SQL');
  });
});
