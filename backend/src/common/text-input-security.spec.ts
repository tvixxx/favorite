import { ValidationPipe } from '@nestjs/common';
import { CreateMovieRequest } from '../movie/dto/create-movie.dto';
import { CreateActorDto, PatchActorDto } from '../actor/dto/create-actor.dto';
import { PatchMovieDto } from '../movie/dto/patch-movie.dto';
import { CreateReviewDto } from '../review/dto/create-review.dto';
import { UpdateReviewDto } from '../review/dto/update-review.dto';
import { CreateUserListDto } from '../user-list/dto/create-user-list.dto';
import { UpdateUserListDto } from '../user-list/dto/update-user-list.dto';
import { PatchUserDto } from '../user/dto/update-user.dto';
import { RegisterRequest } from '../auth/dto/register.dto';
import { CreateFeedbackDto } from '../feedback/dto/create-feedback.dto';
import { queryString } from './utils/query-value';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

describe('Границы цветов и ссылок на изображения', () => {
  it.each([
    'url(https://example.test/pixel)',
    '#fff; background-image: url(https://example.test/pixel)',
    'expression(alert(1))',
  ])(
    'отклоняет CSS в поле цвета при создании и обновлении списка: %s',
    async (color) => {
      await expect(
        validate({ name: 'Список', color }, CreateUserListDto),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        validate({ color }, UpdateUserListDto),
      ).rejects.toMatchObject({
        status: 400,
      });
    },
  );

  it.each([
    'javascript:alert(1)',
    'data:image/svg+xml,<svg onload=alert(1)>',
    'vbscript:msgbox(1)',
    '//example.test/poster.webp',
  ])('отклоняет недопустимую ссылку на изображение: %s', async (url) => {
    for (const [dto, field, extra] of [
      [CreateMovieRequest, 'imageUrl', movie],
      [PatchMovieDto, 'imageUrl', {}],
      [CreateActorDto, 'imageUrl', { name: 'Актёр' }],
      [PatchActorDto, 'imageUrl', {}],
      [PatchUserDto, 'avatarUrl', {}],
    ] as const) {
      await expect(
        validate({ ...extra, [field]: url }, dto),
      ).rejects.toMatchObject({
        status: 400,
      });
    }
  });

  it('сохраняет HEX-цвет и допустимую HTTPS-ссылку', async () => {
    await expect(
      validate({ name: 'Список', color: '#007CFF' }, CreateUserListDto),
    ).resolves.toMatchObject({ color: '#007CFF' });
    const imageUrl = 'https://example.test/poster.webp';

    await expect(validate({ imageUrl }, PatchMovieDto)).resolves.toMatchObject({
      imageUrl,
    });
  });
});
const movie = {
  title: 'Фильм',
  description: 'Описание',
  genres: ['DRAMA'],
  countryCodes: ['US'],
  actorIds: [],
  isSerial: false,
};
const review = {
  text: 'Отзыв о фильме',
  rate: 8,
  movieId: '00000000-0000-4000-8000-000000000001',
};
const validate = (body: unknown, metatype: new () => object) =>
  pipe.transform(body, { type: 'body', metatype });

describe('Границы текстового ввода без порчи обычного текста', () => {
  it('не передаёт управляющие символы из параметров поиска в запрос БД', () => {
    expect(() => queryString('Фильм\u0000', 'q')).toThrow();
    expect(queryString("O'Connor <3", 'q')).toBe("O'Connor <3");
  });
  it.each([
    [CreateMovieRequest, { ...movie, title: 'Я'.repeat(201) }],
    [CreateMovieRequest, { ...movie, description: 'Я'.repeat(10001) }],
    [CreateActorDto, { name: 'Я'.repeat(201) }],
    [CreateReviewDto, { ...review, text: 'Я'.repeat(501) }],
    [UpdateReviewDto, { text: 'Я'.repeat(501), rate: 8 }],
    [CreateUserListDto, { name: 'Мой\u0000список' }],
    [CreateActorDto, { name: 'Имя\nФамилия' }],
    [CreateMovieRequest, { ...movie, description: 'Текст\u0008описания' }],
    [CreateFeedbackDto, { type: 'BUG', message: 'Описание\u0000ошибки' }],
  ])(
    'отклоняет неприемлемую длину и управляющие символы %#',
    async (dto, body) => {
      await expect(validate(body, dto)).rejects.toMatchObject({ status: 400 });
    },
  );
  it('сохраняет кириллицу, апострофы, эмодзи и переносы в многострочном тексте', async () => {
    await expect(
      validate({ name: "  Юрий O'Connor 🙂  " }, CreateActorDto),
    ).resolves.toMatchObject({ name: "Юрий O'Connor 🙂" });
    const description = "О фильме O'Connor <3\nВторая строка\tс деталями 🙂";
    await expect(
      validate(
        { ...movie, title: "  Фильм O'Connor  ", description },
        CreateMovieRequest,
      ),
    ).resolves.toMatchObject({ title: "Фильм O'Connor", description });
  });
  it('не преобразует объекты и массивы в строки и отвергает лишние полномочия', async () => {
    for (const title of [[], {}, 123, null])
      await expect(
        validate({ ...movie, title }, CreateMovieRequest),
      ).rejects.toMatchObject({ status: 400 });
    await expect(
      validate({ ...movie, role: 'ADMIN' }, CreateMovieRequest),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('не обрезает и не меняет пароль при проверке профиля', async () => {
    const password = '  Aa123456  ';
    await expect(
      validate(
        { fullName: 'Пользователь', email: 'qa@example.test', password },
        RegisterRequest,
      ),
    ).resolves.toMatchObject({ password });
  });
});
