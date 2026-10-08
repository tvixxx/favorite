import { UserStatusService } from './user-status.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

it('очищает устаревший онлайн-статус при запуске единственного экземпляра API', async () => {
  const statuses = [
    { userId: 'old', isOnline: true, socketId: 'old-socket' },
    { userId: 'offline', isOnline: false, socketId: null },
  ];
  const prisma = {
    userStatus: {
      updateMany: ({
        where,
        data,
      }: {
        where: { isOnline: boolean };
        data: { isOnline: boolean; socketId: null };
      }) => {
        statuses
          .filter((row) => row.isOnline === where.isOnline)
          .forEach((row) => Object.assign(row, data));
        return Promise.resolve({ count: 1 });
      },
    },
  };

  await new UserStatusService(prisma as never).onModuleInit();
  expect(statuses).toEqual([
    { userId: 'old', isOnline: false, socketId: null },
    { userId: 'offline', isOnline: false, socketId: null },
  ]);
});
