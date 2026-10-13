import { ConflictException, ForbiddenException } from '@nestjs/common';
import { AdminService } from './admin.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../generated/prisma/client';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Безопасные действия администратора', () => {
  function setup() {
    const user = { id: 'target', role: 'ADMIN', blockedAt: null };
    const review = {
      id: 'review',
      userId: 'author',
      hiddenAt: null,
      updatedAt: new Date('2026-10-13T00:00:00Z'),
    };
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        findFirst: jest.fn().mockResolvedValue({ id: 'admin' }),
        count: jest.fn().mockResolvedValue(1),
        update: jest
          .fn<Promise<typeof user>, [Prisma.UserUpdateArgs]>()
          .mockResolvedValue(user),
      },
      review: {
        findUnique: jest.fn().mockResolvedValue(review),
        update: jest
          .fn<Promise<typeof review>, [Prisma.ReviewUpdateArgs]>()
          .mockResolvedValue(review),
      },
      reviewReport: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      adminAuditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      ...tx,
      $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    };
    const gateway = { disconnectUser: jest.fn() };
    const service = new AdminService(
      prisma as unknown as PrismaService,
      gateway as never,
    );

    return { service, tx, gateway };
  }

  it('защищает собственный доступ администратора', async () => {
    const { service, tx } = setup();

    await expect(
      service.changeUser('target', { blocked: true, reason: 'Спам' }, 'target'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('не блокирует последнего действующего администратора', async () => {
    const { service, tx } = setup();

    await expect(
      service.changeUser('target', { blocked: true, reason: 'Спам' }, 'admin'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('блокирует обычного пользователя, пишет причину и отключает его чат', async () => {
    const { service, tx, gateway } = setup();

    tx.user.findUnique.mockResolvedValue({
      id: 'target',
      role: 'USER',
      blockedAt: null,
    });
    await service.changeUser(
      'target',
      { blocked: true, reason: 'Повторный спам' },
      'admin',
    );
    expect(tx.user.update.mock.calls[0][0].data.blockedAt).toBeInstanceOf(Date);
    expect(tx.user.update.mock.calls[0][0].data.blockedReason).toBe(
      'Повторный спам',
    );
    expect(tx.adminAuditLog.create).toHaveBeenCalled();
    expect(gateway.disconnectUser).toHaveBeenCalledWith('target');
  });

  it('не скрывает отзыв поверх несохранённой администратором версии', async () => {
    const { service, tx } = setup();

    await expect(
      service.moderateReview(
        'review',
        { hidden: true, reason: 'Реклама', updatedAt: '2026-10-12T00:00:00Z' },
        'admin',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.review.update).not.toHaveBeenCalled();
  });

  it('скрывает отзыв без изменения текста и закрывает жалобы', async () => {
    const { service, tx } = setup();

    await service.moderateReview(
      'review',
      { hidden: true, reason: 'Реклама', updatedAt: '2026-10-13T00:00:00Z' },
      'admin',
    );
    expect(tx.review.update.mock.calls[0][0].data.hiddenAt).toBeInstanceOf(
      Date,
    );
    expect(tx.review.update.mock.calls[0][0].data.moderationReason).toBe(
      'Реклама',
    );
    expect(Object.keys(tx.review.update.mock.calls[0][0].data).sort()).toEqual([
      'hiddenAt',
      'moderationReason',
    ]);
    expect(tx.reviewReport.updateMany).toHaveBeenCalled();
    expect(tx.adminAuditLog.create).toHaveBeenCalled();
  });

  it('перепроверяет права после ожидания конкурентного изменения администраторов', async () => {
    const { service, tx } = setup();

    tx.user.findFirst.mockResolvedValue(null);
    await expect(
      service.changeUser(
        'target',
        { role: 'USER', reason: 'Смена роли' },
        'admin',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});
