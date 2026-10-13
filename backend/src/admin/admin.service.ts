import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessageGateway } from '../message/message.gateway';
import { lockResource } from '../common/utils/transaction-lock';
import type { Prisma } from '../generated/prisma/client';
import type { ChangeUserDto, ModerateReviewDto } from './admin.dto';
import {
  createdAtRange,
  type UsersQueryDto,
  type CatalogQueryDto,
} from '../common/dto/list-query.dto';

export type PageQuery = { q?: string; limit: number; offset: number };
const userSelect = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  createdAt: true,
  blockedAt: true,
  blockedReason: true,
  avatarThumbnailUrl: true,
  _count: { select: { userMovies: true, reviews: true } },
} as const;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MessageGateway,
  ) {}

  public async users(query: UsersQueryDto) {
    const where: Prisma.UserWhereInput = query.q
      ? {
          OR: [
            { fullName: { contains: query.q, mode: 'insensitive' } },
            { email: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {};
    where.role = query.role;
    where.createdAt = createdAtRange(query);
    if (query.state) {
      where.blockedAt = query.state === 'blocked' ? { not: null } : null;
    }

    const order = query.sort === 'oldest' ? 'asc' : 'desc';
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: [{ createdAt: order }, { id: order }],
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, limit: query.limit, offset: query.offset };
  }

  public async changeUser(
    id: string,
    dto: ChangeUserDto,
    actorId: string,
  ): Promise<void> {
    if ((dto.blocked === undefined) === (dto.role === undefined)) {
      throw new BadRequestException('Укажите ровно одно изменение доступа');
    }

    if (id === actorId) {
      throw new ForbiddenException(
        'Собственные права и блокировку меняет другой администратор',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await lockResource(tx, 'admin:user-access');
      const actor = await tx.user.findFirst({
        where: { id: actorId, role: 'ADMIN', blockedAt: null },
        select: { id: true },
      });

      if (!actor) {
        throw new ForbiddenException('Права администратора изменились');
      }

      const target = await tx.user.findUnique({ where: { id } });

      if (!target) {
        throw new NotFoundException('Пользователь не найден');
      }

      if (
        target.role === 'ADMIN' &&
        !target.blockedAt &&
        (dto.blocked === true || dto.role === 'USER')
      ) {
        const admins = await tx.user.count({
          where: { role: 'ADMIN', blockedAt: null },
        });

        if (admins <= 1) {
          throw new ConflictException(
            'Нельзя ограничить последнего администратора',
          );
        }
      }

      await tx.user.update({
        where: { id },
        data: {
          ...(dto.role ? { role: dto.role } : {}),
          ...(dto.blocked !== undefined
            ? {
                blockedAt: dto.blocked ? new Date() : null,
                blockedReason: dto.blocked ? dto.reason : null,
              }
            : {}),
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId,
          targetId: id,
          action:
            dto.blocked !== undefined
              ? dto.blocked
                ? 'USER_BLOCK'
                : 'USER_UNBLOCK'
              : `USER_ROLE_${dto.role}`,
          reason: dto.reason,
        },
      });
    });

    if (dto.blocked) {
      this.gateway.disconnectUser(id);
    }
  }

  public async movies(query: CatalogQueryDto) {
    const base: Prisma.MovieWhereInput = {
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' } } : {}),
      ...(query.kind ? { isSerial: query.kind === 'serial' } : {}),
      ...(query.author?.trim()
        ? {
            createdBy: {
              fullName: { contains: query.author.trim(), mode: 'insensitive' },
            },
          }
        : {}),
      createdAt: createdAtRange(query),
    };
    const missing: Record<string, Prisma.MovieWhereInput> = {
      poster: { OR: [{ poster: null }, { poster: { url: '' } }] },
      date: { publishDate: null },
      actors: { actors: { none: {} } },
    };
    const where: Prisma.MovieWhereInput = {
      AND: [base, query.quality ? missing[query.quality] : {}],
    };
    const order = query.sort === 'oldest' ? 'asc' : 'desc';
    const [items, total, poster, date, actors] = await this.prisma.$transaction(
      [
        this.prisma.movie.findMany({
          where,
          take: query.limit,
          skip: query.offset,
          orderBy: [{ createdAt: order }, { id: order }],
          include: {
            poster: true,
            createdBy: { select: { id: true, fullName: true } },
            _count: {
              select: {
                userMovies: true,
                actors: true,
                reviews: true,
                listItems: true,
              },
            },
          },
        }),
        this.prisma.movie.count({ where }),
        this.prisma.movie.count({ where: { AND: [base, missing.poster] } }),
        this.prisma.movie.count({ where: { AND: [base, missing.date] } }),
        this.prisma.movie.count({ where: { AND: [base, missing.actors] } }),
      ],
    );

    return {
      items,
      total,
      limit: query.limit,
      offset: query.offset,
      quality: { poster, date, actors },
    };
  }

  public async reviews(query: PageQuery & { scope?: 'reported' | 'hidden' }) {
    const where: Prisma.ReviewWhereInput = {
      ...(query.q
        ? { movie: { title: { contains: query.q, mode: 'insensitive' } } }
        : {}),
      ...(query.scope === 'hidden' ? { hiddenAt: { not: null } } : {}),
      ...(query.scope === 'reported'
        ? { reports: { some: { resolvedAt: null } } }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          user: { select: { id: true, fullName: true } },
          movie: { select: { id: true, title: true } },
          reports: {
            where: { resolvedAt: null },
            take: 20,
            orderBy: { createdAt: 'asc' },
            select: { id: true, reason: true, comment: true, createdAt: true },
          },
          _count: { select: { reports: { where: { resolvedAt: null } } } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return { items, total, limit: query.limit, offset: query.offset };
  }

  public async moderateReview(
    id: string,
    dto: ModerateReviewDto,
    actorId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockResource(tx, `review:${id}`);
      const review = await tx.review.findUnique({ where: { id } });

      if (!review) {
        throw new NotFoundException('Отзыв не найден');
      }

      if (review.updatedAt.getTime() !== new Date(dto.updatedAt).getTime()) {
        throw new ConflictException(
          'Отзыв изменился. Обновите данные перед решением',
        );
      }

      await tx.review
        .update({
          where: { id, updatedAt: review.updatedAt },
          data: {
            hiddenAt: dto.hidden ? new Date() : null,
            moderationReason: dto.hidden ? dto.reason : null,
          },
        })
        .catch((error: unknown) => {
          if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 'P2025'
          ) {
            throw new ConflictException(
              'Отзыв изменился. Обновите данные перед решением',
            );
          }

          throw error;
        });
      await tx.reviewReport.updateMany({
        where: { reviewId: id, resolvedAt: null },
        data: { resolvedAt: new Date() },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId,
          targetId: id,
          action: dto.hidden ? 'REVIEW_HIDE' : 'REVIEW_RESTORE',
          reason: dto.reason,
        },
      });
    });
  }

  public async dismissReports(
    id: string,
    reason: string,
    actorId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.reviewReport.updateMany({
        where: { reviewId: id, resolvedAt: null },
        data: { resolvedAt: new Date() },
      });
      await tx.adminAuditLog.create({
        data: { actorId, targetId: id, action: 'REPORT_DISMISS', reason },
      });
    });
  }

  public audit(targetId: string) {
    return this.prisma.adminAuditLog.findMany({
      where: { targetId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { actor: { select: { fullName: true } } },
    });
  }
}
