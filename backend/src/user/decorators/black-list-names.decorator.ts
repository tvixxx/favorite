import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

export function BlackListNames(
  list: string[],
  validationOptions?: ValidationOptions,
) {
  return (object: Object, propertyName: string) => {
    registerDecorator({
      name: 'BlackListNames',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args?: ValidationArguments) {
          return typeof value === 'string' && !hasForbiddenWord(value, list);
        },
        defaultMessage(args?: ValidationArguments): string {
          return `Название не может иметь такие слова как: ${list}`;
        },
      },
    });
  };
}

function hasForbiddenWord(text: string, forbiddenWords: string[]): boolean {
  const lowerText = text.toLowerCase();

  return forbiddenWords.some(
    (word) =>
      lowerText.startsWith(word) ||
      lowerText.endsWith(word) ||
      lowerText.includes(`${word}`) || // слово в середине
      lowerText === word,
  );
}
