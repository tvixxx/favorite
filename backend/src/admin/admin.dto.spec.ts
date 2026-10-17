import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ChangeUserDto,
  ModerateReviewDto,
  ReportReviewDto,
  UsageEventDto,
} from './admin.dto';

describe('Границы административных команд', () => {
  it.each([
    { blocked: null },
    { blocked: 'false' },
    { role: 'OWNER' },
    { role: null },
  ])('не принимает некорректное изменение доступа %p', async (data) => {
    expect(
      await validate(
        plainToInstance(ChangeUserDto, { ...data, reason: 'Причина' }),
      ),
    ).not.toHaveLength(0);
  });
  it('не принимает пустую причину и некорректную версию отзыва', async () => {
    expect(
      await validate(
        plainToInstance(ModerateReviewDto, {
          hidden: true,
          reason: '   ',
          updatedAt: 'bad',
        }),
      ),
    ).toHaveLength(2);
  });
  it('ограничивает перечень жалоб и событий аналитики', async () => {
    expect(
      await validate(
        plainToInstance(ReportReviewDto, { reason: 'DELETE_USER' }),
      ),
    ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(UsageEventDto, { id: 'not-uuid', feature: 'PASSWORD' }),
      ),
    ).toHaveLength(2);
  });
});
