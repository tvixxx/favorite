import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  public use(req: Request, res: Response, next: NextFunction): void {
    console.log(`Request: ${req.method}, ${req.path}`);

    next();
  }
}

export function LoggerMiddlewareFn(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Query-параметры могут содержать email или подписанные ссылки.
  console.log(`Request: ${req.method}, ${req.path}`);

  next();
}
