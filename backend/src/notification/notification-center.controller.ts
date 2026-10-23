import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';
import { AuthProtected, Authorized, AdminOnly } from '../common/decorators';
import type { User } from '../generated/prisma/client';
import {
  queryBoolean,
  queryEnum,
  queryInteger,
  queryString,
} from '../common/utils/query-value';
import {
  NotificationCenterService,
  type CenterQuery,
} from './notification-center.service';
import { AnnouncementService } from './announcement.service';
import { AnnouncementDraftDto } from './announcement.dto';
import { notificationEvents } from './notification-events';

export class ReadScopeDto {
  @IsIn(['people', 'person', 'system'])
  scope: 'people' | 'person' | 'system';
  @IsOptional()
  @IsUUID('4')
  actorId?: string;
  @IsDateString()
  through: string;
}
function page(query: Record<string, unknown>): CenterQuery {
  if (
    Object.keys(query).some(
      (key) =>
        ![
          'limit',
          'offset',
          'q',
          'unreadOnly',
          'kind',
          'category',
          'through',
        ].includes(key),
    )
  )
    throw new BadRequestException('Неизвестный параметр');
  const q = queryString(query.q, 'q')?.trim();
  if (q && q.length > 200)
    throw new BadRequestException('Слишком длинный запрос');
  let through: Date | undefined;
  if (query.through !== undefined) {
    if (
      typeof query.through !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T/.test(query.through) ||
      !Number.isFinite(Date.parse(query.through))
    )
      throw new BadRequestException('Некорректная дата');
    through = new Date(Math.min(Date.parse(query.through), Date.now()));
  }
  return {
    limit: queryInteger(query.limit, 'limit', 20, 1, 50),
    offset: queryInteger(query.offset, 'offset', 0, 0, 100000),
    q,
    unreadOnly: queryBoolean(query.unreadOnly, 'unreadOnly') ?? false,
    kind: queryEnum(query.kind, 'kind', ['chat', 'friends']),
    through,
  };
}

@Controller('users/:userId/notification-center')
@AuthProtected()
export class NotificationCenterController {
  public constructor(
    private readonly center: NotificationCenterService,
    private readonly announcements: AnnouncementService,
  ) {}
  private self(userId: string, user: User): void {
    if (userId !== user.id) throw new ForbiddenException();
  }

  @Get('summary')
  public summary(@Param('userId') userId: string, @Authorized() user: User) {
    this.self(userId, user);
    return this.center.summary(userId);
  }
  @Get('senders')
  public senders(
    @Param('userId') userId: string,
    @Authorized() user: User,
    @Query() query: Record<string, unknown>,
  ) {
    this.self(userId, user);
    return this.center.senders(userId, page(query));
  }
  @Get('people/:actorId')
  public people(
    @Param('userId') userId: string,
    @Param('actorId', new ParseUUIDPipe()) actorId: string,
    @Authorized() user: User,
    @Query() query: Record<string, unknown>,
  ) {
    this.self(userId, user);
    return this.center.people(userId, actorId, page(query));
  }
  @Get('system')
  public system(
    @Param('userId') userId: string,
    @Authorized() user: User,
    @Query() query: Record<string, unknown>,
  ) {
    this.self(userId, user);
    return this.announcements.page(userId, {
      ...page(query),
      category: queryEnum(query.category, 'category', [
        'NEWS',
        'SERVICE',
        'RELEASE',
      ]),
    });
  }
  @Patch('system/:id/read')
  public async readSystem(
    @Param('userId') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Authorized() user: User,
  ): Promise<void> {
    this.self(userId, user);
    await this.announcements.markRead(userId, id);
    notificationEvents.emit('changed', userId);
  }
  @Post('read')
  public async read(
    @Param('userId') userId: string,
    @Authorized() user: User,
    @Body() dto: ReadScopeDto,
  ): Promise<void> {
    this.self(userId, user);
    const through = new Date(Math.min(Date.parse(dto.through), Date.now()));
    if (dto.scope === 'person' && !dto.actorId)
      throw new BadRequestException('Не указан отправитель');
    if (dto.scope === 'system')
      await this.announcements.markAllRead(userId, through);
    else
      await this.center.readPeople(
        userId,
        dto.scope === 'person' ? dto.actorId : undefined,
        through,
      );
    notificationEvents.emit('changed', userId);
  }
}

@Controller('admin/announcements')
@AdminOnly()
export class AnnouncementAdminController {
  public constructor(private readonly announcements: AnnouncementService) {}
  @Get()
  public list(
    @Query('limit') limit?: unknown,
    @Query('offset') offset?: unknown,
  ) {
    return this.announcements.adminPage(
      queryInteger(limit, 'limit', 20, 1, 50),
      queryInteger(offset, 'offset', 0, 0, 100000),
    );
  }
  @Post()
  public create(@Body() dto: AnnouncementDraftDto) {
    return this.announcements.createDraft(dto);
  }
  @Patch(':id')
  public update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AnnouncementDraftDto,
  ) {
    return this.announcements.updateDraft(id, dto);
  }
  @Post(':id/publish')
  public async publish(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Authorized() user: User,
  ): Promise<void> {
    if (await this.announcements.publish(id, user.id))
      notificationEvents.emit('changed');
  }
  @Post(':id/archive')
  public async archive(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Authorized() user: User,
  ): Promise<void> {
    await this.announcements.archive(id, user.id);
    notificationEvents.emit('changed');
  }
}
