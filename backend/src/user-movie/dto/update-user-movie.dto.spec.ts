import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateUserMovieDto } from './update-user-movie.dto';

describe('Валидация параметров коллекции', () => {
  it.each(['isFavorite', 'seeLater', 'watchStatus'])(
    'отклоняет null для %s',
    async (field) => {
      const errors = await validate(
        plainToInstance(UpdateUserMovieDto, { [field]: null }),
      );
      expect(errors.map((error) => error.property)).toContain(field);
    },
  );
  it('позволяет пропустить поля и очистить nullable прогресс и оценку', async () => {
    const errors = await validate(
      plainToInstance(UpdateUserMovieDto, {
        personalRate: null,
        currentEpisode: null,
        completedAt: null,
      }),
    );
    expect(errors).toEqual([]);
  });
});
