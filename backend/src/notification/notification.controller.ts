import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthProtected, Authorized } from '../common/decorators';
import type { User } from '../generated/prisma/client';
import { NotificationService } from './notification.service';

@ApiTags('Notifications')
@Controller('users/:userId/notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  private ensureSelf(paramUserId: string, user: { id: string }): void {
    if (paramUserId !== user.id) {
      throw new ForbiddenException();
    }
  }

  @ApiOperation({ summary: 'Список уведомлений пользователя' })
  @ApiOkResponse({ description: 'Уведомления' })
  @ApiBearerAuth()
  @AuthProtected()
  @Get()
  public findAll(
    @Param('userId') userId: string,
    @Authorized() user: User,
    @Query('limit') limitRaw?: string,
  ) {
    this.ensureSelf(userId, user);

    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 30;

    return this.notificationService.findManyForUser(
      userId,
      Number.isFinite(limit) ? limit : 30,
    );
  }

  @ApiOperation({ summary: 'Число непрочитанных уведомлений' })
  @ApiOkResponse({ description: 'Количество' })
  @ApiBearerAuth()
  @AuthProtected()
  @Get('unread-count')
  public unreadCount(
    @Param('userId') userId: string,
    @Authorized() user: User,
  ) {
    this.ensureSelf(userId, user);

    return this.notificationService.unreadCount(userId);
  }

  @ApiOperation({ summary: 'Отметить уведомление прочитанным' })
  @ApiOkResponse({ description: 'Обновлённое уведомление или null' })
  @ApiBearerAuth()
  @AuthProtected()
  @Patch(':notificationId/read')
  public markRead(
    @Param('userId') userId: string,
    @Param('notificationId') notificationId: string,
    @Authorized() user: User,
  ) {
    this.ensureSelf(userId, user);

    return this.notificationService.markRead(userId, notificationId);
  }

  @ApiOperation({ summary: 'Отметить все уведомления прочитанными' })
  @ApiOkResponse({ description: 'Готово' })
  @ApiBearerAuth()
  @AuthProtected()
  @Post('read-all')
  public markAllRead(
    @Param('userId') userId: string,
    @Authorized() user: User,
  ) {
    this.ensureSelf(userId, user);

    return this.notificationService.markAllRead(userId);
  }
}
