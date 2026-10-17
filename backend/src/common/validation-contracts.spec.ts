import { ValidationPipe } from '@nestjs/common';
import { PatchMovieDto } from '../movie/dto/patch-movie.dto';
import { PatchActorDto } from '../actor/dto/create-actor.dto';
import { PatchUserDto } from '../user/dto/update-user.dto';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { CreateReviewDto } from '../review/dto/create-review.dto';
import { UpdateUserListDto } from '../user-list/dto/update-user-list.dto';
import { CreateUserMovieBodyDto } from '../user-movie/dto/create-user-movie.dto';
import { RegisterRequest } from '../auth/dto/register.dto';
import { CreateFeedbackDto } from '../feedback/dto/create-feedback.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
const validate = (value: unknown, metatype: new () => object) =>
  pipe.transform(value, { type: 'body', metatype });

describe('Контракты входных данных API', () => {
  describe.each([RegisterRequest, CreateUserDto, PatchUserDto])(
    '%p: имя',
    (dto) => {
      const account = { email: 'qa@example.test', password: 'Test1234' };
      const body = (fullName: string) =>
        dto === PatchUserDto ? { fullName } : { ...account, fullName };

      it.each(['Имя', 'Я'.repeat(50)])(
        'принимает границы после trim',
        async (name) => {
          await expect(
            validate(body(`  ${name}  `), dto),
          ).resolves.toMatchObject({
            fullName: name,
          });
        },
      );

      it.each(['  Яя  ', 'Я'.repeat(51)])(
        'отклоняет длину вне границ',
        async (name) => {
          await expect(validate(body(name), dto)).rejects.toMatchObject({
            status: 400,
          });
        },
      );
    },
  );

  it('принимает 100 сезонов и 5000 эпизодов, отклоняет превышение', async () => {
    await expect(
      validate({ seasonCount: 100, episodeCount: 5000 }, PatchMovieDto),
    ).resolves.toMatchObject({ seasonCount: 100, episodeCount: 5000 });
    await expect(
      validate({ seasonCount: 101 }, PatchMovieDto),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      validate({ episodeCount: 5001 }, PatchMovieDto),
    ).rejects.toMatchObject({ status: 400 });
  });

  it.each([
    [PatchMovieDto, { title: null }],
    [PatchMovieDto, { actorIds: null }],
    [PatchMovieDto, { publishDate: 'invalid-date' }],
    [PatchActorDto, { name: null }],
    [PatchActorDto, { name: '   ' }],
    [PatchUserDto, { fullName: null }],
    [UpdateUserListDto, { name: null }],
    [UpdateUserListDto, { labels: null }],
    [UpdateUserListDto, { name: '   ' }],
    [
      RegisterRequest,
      { fullName: '   ', email: 'qa@example.test', password: 'Test1234' },
    ],
    [
      CreateUserDto,
      { fullName: '   ', email: 'qa@example.test', password: 'Test1234' },
    ],
    [CreateFeedbackDto, { type: 'BUG', message: '          ' }],
    [
      CreateUserMovieBodyDto,
      { movieId: 'dfbb0bf9-2b86-4b8b-a1c7-d139326edaa7', isFavorite: null },
    ],
    [
      CreateUserMovieBodyDto,
      { movieId: 'dfbb0bf9-2b86-4b8b-a1c7-d139326edaa7', watchStatus: null },
    ],
  ])(
    'отклоняет некорректный PATCH до вызова Prisma: %p %p',
    async (dto, body) => {
      await expect(validate(body, dto)).rejects.toMatchObject({ status: 400 });
    },
  );

  it('сохраняет частичный PATCH и очистку nullable-полей', async () => {
    await expect(validate({}, PatchMovieDto)).resolves.toEqual({});
    await expect(
      validate({ avatarUrl: null, tags: null }, PatchUserDto),
    ).resolves.toMatchObject({ avatarUrl: null, tags: null });
    await expect(
      validate({ description: null, color: null }, UpdateUserListDto),
    ).resolves.toMatchObject({ description: null, color: null });
  });

  it('принимает скалярный тег пользователя, соответствующий схеме Prisma', async () => {
    await expect(
      validate(
        {
          fullName: 'Tester',
          email: 'qa@example.com',
          password: 'Test1234',
          tags: 'DRAMA',
        },
        CreateUserDto,
      ),
    ).resolves.toMatchObject({ tags: 'DRAMA' });
    await expect(
      validate({ tags: ['DRAMA'] }, PatchUserDto),
    ).rejects.toMatchObject({ status: 400 });
  });

  it.each([2.5, NaN])('отклоняет нецелую оценку %p', async (rate) => {
    await expect(
      validate(
        {
          text: 'Нормальный отзыв',
          rate,
          movieId: 'dfbb0bf9-2b86-4b8b-a1c7-d139326edaa7',
        },
        CreateReviewDto,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});
