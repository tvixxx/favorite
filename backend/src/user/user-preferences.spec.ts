import {
  BadRequestException,
  ForbiddenException,
  ValidationPipe,
} from '@nestjs/common';
import { PatchUserDto } from './dto/update-user.dto';
import { UserService } from './user.service';
import { UserController } from './user.controller';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const preferences = {
  quickAddEnabled: false,
  watchTonightEnabled: true,
  collectionFilesEnabled: true,
  notifyNewMessages: false,
  notifyFriendRequests: false,
  notifyRecommendations: true,
};

describe('Персональные настройки профиля', () => {
  it('принимает только boolean и не пропускает null, строки или произвольные поля', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    const metadata = { type: 'body' as const, metatype: PatchUserDto };
    await expect(pipe.transform(preferences, metadata)).resolves.toMatchObject(
      preferences,
    );
    for (const key of Object.keys(preferences)) {
      for (const value of [null, 'true', 1]) {
        await expect(
          pipe.transform({ [key]: value }, metadata),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
    }
    await expect(
      pipe.transform({ unknownPreference: true }, metadata),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('сохраняет все шесть переключателей, не затрагивая имя и чужой аккаунт', async () => {
    const users: Record<string, Record<string, unknown>> = {
      owner: {
        id: 'owner',
        fullName: 'Владелец',
        avatarAssetId: null,
        ...Object.fromEntries(
          Object.entries(preferences).map(([key, value]) => [key, !value]),
        ),
      },
      other: { id: 'other', fullName: 'Другой', avatarAssetId: null },
    };
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      user: {
        findUnique: jest.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve(users[where.id]),
        ),
        update: jest.fn(
          ({
            where,
            data,
            select,
          }: {
            where: { id: string };
            data: Record<string, unknown>;
            select: Record<string, boolean>;
          }) => {
            Object.assign(
              users[where.id],
              Object.fromEntries(
                Object.entries(data).filter(([, value]) => value !== undefined),
              ),
            );
            return Promise.resolve(
              Object.fromEntries(
                Object.keys(select).map((key) => [key, users[where.id][key]]),
              ),
            );
          },
        ),
      },
    };
    const service = new UserService(
      {
        $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
      } as never,
      {} as never,
    );
    expect(await service.patch('owner', preferences as never)).toMatchObject(
      preferences,
    );
    expect(users.owner).toMatchObject({ fullName: 'Владелец', ...preferences });
    expect(users.other).toEqual({
      id: 'other',
      fullName: 'Другой',
      avatarAssetId: null,
    });
    expect(
      await service.patch('owner', { fullName: 'Новое имя' }),
    ).toMatchObject(preferences);
  });

  it('не разрешает менять переключатели чужого профиля', () => {
    const service = { patch: jest.fn() };
    const controller = new UserController(service as never);
    expect(() =>
      controller.patchUpdate(
        'other',
        preferences as never,
        { id: 'owner', role: 'USER' } as never,
      ),
    ).toThrow(ForbiddenException);
    expect(service.patch).not.toHaveBeenCalled();
  });
});
