import { Transform } from 'class-transformer';
import { ValidateBy } from 'class-validator';

export function isPlainText(
  value: unknown,
  multiline = false,
): value is string {
  return (
    typeof value === 'string' &&
    [...value].every((character) => {
      const code = character.charCodeAt(0);
      return (
        (code >= 32 && !(code >= 127 && code <= 159)) ||
        (multiline && [9, 10, 13].includes(code))
      );
    })
  );
}

export function PlainText(
  options: { multiline?: boolean; each?: boolean } = {},
): PropertyDecorator {
  const trim = (value: unknown): unknown =>
    typeof value === 'string' ? value.trim() : value;
  const transform = Transform(({ value }: { value: unknown }) =>
    options.each && Array.isArray(value) ? value.map(trim) : trim(value),
  );
  const validate = ValidateBy(
    {
      name: 'plainText',
      validator: {
        validate: (value) => isPlainText(value, options.multiline),
        defaultMessage: () => 'Текст содержит недопустимые управляющие символы',
      },
    },
    { each: options.each },
  );
  return (target, property) => {
    transform(target, property);
    validate(target, property);
  };
}
