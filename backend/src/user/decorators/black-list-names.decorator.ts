import { registerDecorator, type ValidationOptions } from 'class-validator';

export function BlackListNames(
  list: string[],
  validationOptions?: ValidationOptions,
) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'BlackListNames',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && !hasForbiddenWord(value, list);
        },
        defaultMessage(): string {
          return `Название не может иметь такие слова как: ${list.join(',')}`;
        },
      },
    });
  };
}

function hasForbiddenWord(text: string, forbiddenWords: string[]): boolean {
  const lowerText = text.toLowerCase();

  return forbiddenWords.some((word) => lowerText.includes(word));
}
