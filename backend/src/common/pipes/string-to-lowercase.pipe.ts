import type { PipeTransform } from '@nestjs/common';

export class StringToLowercasePipe implements PipeTransform {
  public transform(value: unknown): unknown {
    if (typeof value === 'string') {
      return value.toLowerCase();
    }

    return value;
  }
}
