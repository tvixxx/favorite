import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

export function isFeedbackEnabled(config: ConfigService): boolean {
  return config.get<string>('FEEDBACK_ENABLED') === 'true';
}

export function assertFeedbackEnabled(config: ConfigService): void {
  if (!isFeedbackEnabled(config)) {
    throw new ServiceUnavailableException('Обратная связь отключена');
  }
}
