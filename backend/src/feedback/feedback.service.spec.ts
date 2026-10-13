import { FeedbackService } from './feedback.service';
import type { PrismaService } from '../prisma/prisma.service';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Административная очередь обращений', () => {
  it('возвращает 404 для отсутствующего обращения', async () => {
    const service = new FeedbackService({
      feedback: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService);

    await expect(
      service.updateStatus('missing', 'DONE', 'admin'),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('меняет статус и записывает администратора в журнал без изменения текста', async () => {
    const update = jest.fn().mockResolvedValue({
      id: 'feedback',
      status: 'DONE',
      message: 'Текст обращения',
    });
    const create = jest.fn().mockResolvedValue({});
    const tx = { feedback: { update }, adminAuditLog: { create } };
    const service = new FeedbackService({
      feedback: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'feedback', status: 'NEW' }),
      },
      $transaction: (work: (client: typeof tx) => Promise<unknown>) => work(tx),
    } as unknown as PrismaService);

    expect(
      await service.updateStatus('feedback', 'DONE', 'admin'),
    ).toMatchObject({ status: 'DONE', message: 'Текст обращения' });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'feedback' },
      data: { status: 'DONE' },
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        actorId: 'admin',
        targetId: 'feedback',
        action: 'FEEDBACK_STATUS',
        reason: 'NEW → DONE',
      },
    });
  });
});
