import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReviewService } from './review.service';
import type { PrismaService } from '../prisma/prisma.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Жалобы на отзывы', () => {
  function setup(userId = 'author', hiddenAt: Date | null = null) {
    const review = {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'review', userId, hiddenAt }),
      update: jest.fn(),
    };
    const reviewReport = {
      upsert: jest.fn().mockResolvedValue({ id: 'report' }),
    };
    const service = new ReviewService({
      review,
      reviewReport,
    } as unknown as PrismaService);

    return { service, review, reviewReport };
  }

  it('не даёт жаловаться на свой отзыв', async () => {
    const { service, reviewReport } = setup('me');

    await expect(
      service.report('review', 'me', { reason: 'SPAM' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(reviewReport.upsert).not.toHaveBeenCalled();
  });

  it('отправляет жалобу без автоматического скрытия отзыва', async () => {
    const { service, review, reviewReport } = setup();

    await service.report('review', 'me', {
      reason: 'SPOILER',
      comment: 'Финал без предупреждения',
    });
    expect(review.update).not.toHaveBeenCalled();
    expect(reviewReport.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          reviewId_reporterId: { reviewId: 'review', reporterId: 'me' },
        },
        update: {},
      }),
    );
  });

  it('не возвращает скрытый отзыв по публичной ссылке', async () => {
    const { service } = setup('author', new Date());

    await expect(service.findById('review')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
