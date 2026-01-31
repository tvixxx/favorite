import { ArgumentMetadata, PipeTransform } from '@nestjs/common';

export class StringToLowercasePipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata): any {
    if (typeof value === 'string') {
      return value.toLowerCase();
    }

    return value;
  }
}
