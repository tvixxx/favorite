import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { type Announcement, type Prisma } from '../generated/prisma/client';
import {
  AnnouncementDraftDto,
  ReleaseNoteDto,
  type AnnouncementActionDto,
} from './announcement.dto';

export interface AnnouncementDto {
  id: string;
  type: 'SYSTEM';
  title: string;
  body: string;
  category: string;
  actions: AnnouncementActionDto[];
  releaseId: string | null;
  createdAt: string;
  readAt: string | null;
}

@Injectable()
export class AnnouncementService {
  public constructor(private readonly prisma: PrismaService) {}

  public toDto(
    row: Announcement & { reads?: { readAt: Date }[] },
  ): AnnouncementDto {
    return {
      id: row.id,
      type: 'SYSTEM',
      title: row.title,
      body: row.body,
      category: row.category,
      actions: row.actions as unknown as AnnouncementActionDto[],
      releaseId: row.releaseId,
      createdAt: (row.publishedAt ?? row.createdAt).toISOString(),
      readAt: row.reads?.[0]?.readAt.toISOString() ?? null,
    };
  }

  public visibleWhere(
    userId: string,
    options: {
      unreadOnly?: boolean;
      category?: string;
      q?: string;
      through?: Date;
    } = {},
  ): Prisma.AnnouncementWhereInput {
    return {
      publishedAt: { not: null, lte: options.through ?? new Date() },
      archivedAt: null,
      ...(options.unreadOnly ? { reads: { none: { userId } } } : {}),
      ...(options.category ? { category: options.category } : {}),
      ...(options.q
        ? {
            OR: [
              { title: { contains: options.q, mode: 'insensitive' } },
              { body: { contains: options.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  public async page(
    userId: string,
    options: {
      limit: number;
      offset: number;
      unreadOnly?: boolean;
      category?: string;
      q?: string;
      through?: Date;
    },
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const where = this.visibleWhere(userId, options);
        const [rows, total, unread] = await Promise.all([
          tx.announcement.findMany({
            where,
            orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
            skip: options.offset,
            take: options.limit,
            include: { reads: { where: { userId } } },
          }),
          tx.announcement.count({ where }),
          tx.announcement.count({
            where: this.visibleWhere(userId, { unreadOnly: true }),
          }),
        ]);
        return { items: rows.map((row) => this.toDto(row)), total, unread };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  public async markRead(userId: string, id: string): Promise<void> {
    const exists = await this.prisma.announcement.findFirst({
      where: { ...this.visibleWhere(userId), id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Объявление не найдено');
    await this.prisma.announcementRead.createMany({
      data: [{ userId, announcementId: id }],
      skipDuplicates: true,
    });
  }

  public async markAllRead(userId: string, through: Date): Promise<void> {
    // Единый SQL-снимок не пометит объявления, опубликованные после нажатия.
    await this.prisma.$executeRaw`
      INSERT INTO announcement_reads (user_id, announcement_id, read_at)
      SELECT ${userId}, id, CURRENT_TIMESTAMP FROM announcements
      WHERE published_at IS NOT NULL AND published_at <= ${through} AND archived_at IS NULL
      ON CONFLICT (user_id, announcement_id) DO NOTHING
    `;
  }

  public async adminPage(limit: number, offset: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.announcement.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.announcement.count(),
    ]);
    return { items, total };
  }

  public createDraft(dto: AnnouncementDraftDto) {
    return this.prisma.announcement.create({
      data: {
        ...dto,
        actions: dto.actions as unknown as Prisma.InputJsonValue,
      },
    });
  }

  public async updateDraft(
    id: string,
    dto: AnnouncementDraftDto,
  ): Promise<void> {
    const result = await this.prisma.announcement.updateMany({
      where: { id, publishedAt: null, archivedAt: null },
      data: {
        ...dto,
        actions: dto.actions as unknown as Prisma.InputJsonValue,
      },
    });
    if (!result.count)
      throw new ConflictException('Менять можно только черновик');
  }

  public async publish(id: string, actorId: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.announcement.updateMany({
        where: { id, publishedAt: null, archivedAt: null, releaseId: null },
        data: { publishedAt: new Date() },
      });
      if (!result.count) {
        if (!(await tx.announcement.findUnique({ where: { id } })))
          throw new NotFoundException();
        return false;
      }
      await tx.adminAuditLog.create({
        data: {
          actorId,
          targetId: id,
          action: 'ANNOUNCEMENT_PUBLISH',
          reason: 'Публикация системного объявления',
        },
      });
      return true;
    });
  }

  public async archive(id: string, actorId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.announcement.updateMany({
        where: { id, archivedAt: null },
        data: { archivedAt: new Date() },
      });
      if (!result.count) throw new NotFoundException();
      await tx.adminAuditLog.create({
        data: {
          actorId,
          targetId: id,
          action: 'ANNOUNCEMENT_ARCHIVE',
          reason: 'Архивация системного объявления',
        },
      });
    });
  }

  public async publishRelease(dto: ReleaseNoteDto): Promise<void> {
    await this.prisma.announcement.createMany({
      data: [
        {
          title: dto.title,
          body: dto.body,
          category: 'RELEASE',
          actions: dto.actions as unknown as Prisma.InputJsonValue,
          releaseId: dto.id,
          publishedAt: new Date(),
        },
      ],
      skipDuplicates: true,
    });
  }
}
