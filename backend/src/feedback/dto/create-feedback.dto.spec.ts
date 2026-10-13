import { ValidationPipe } from '@nestjs/common';
import { CreateFeedbackDto } from './create-feedback.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
const validate = (value: unknown) =>
  pipe.transform(value, { type: 'body', metatype: CreateFeedbackDto });

describe('Проверка текста обратной связи', () => {
  it('отклоняет короткий текст, дополненный пробелами', async () => {
    await expect(
      validate({ type: 'BUG', message: '  коротко   ' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('принимает границы длины после удаления крайних пробелов', async () => {
    for (const length of [10, 1000]) {
      const text = 'а'.repeat(length);

      await expect(
        validate({ type: 'IDEA', message: `  ${text}  ` }),
      ).resolves.toMatchObject({ message: text });
    }
  });

  it('отклоняет превышение длины и подмену автора', async () => {
    await expect(
      validate({ type: 'OTHER', message: 'а'.repeat(1001) }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      validate({
        type: 'BUG',
        message: 'Корректный текст',
        userId: 'another-user',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
