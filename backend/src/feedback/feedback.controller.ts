import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto, UpdateFeedbackStatusDto } from './dto';
import { AdminOnly, AuthProtected, Authorized } from '../common/decorators';
import type { User } from '../generated/prisma/client';
import { FeedbackStatus } from '../generated/prisma/enums';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

@ApiTags('Feedback')
@Controller('feedback')
@UseGuards(ThrottlerGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @ApiOperation({
    summary: 'Отправить обращение',
    description:
      'Форма «Обратная связь». Автор берётся из токена. Ограничение — 5 обращений в час.',
  })
  @ApiCreatedResponse({ description: 'Обращение создано' })
  @AuthProtected()
  // Форма открыта всем авторизованным — ограничиваем поток, чтобы её не заспамили
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async create(
    @Body() dto: CreateFeedbackDto,
    @Authorized() user: User,
  ): Promise<{ id: string }> {
    return this.feedbackService.create(user.id, dto);
  }

  @ApiOperation({
    summary: 'Список обращений (администратор)',
    description:
      'Свежие сверху. Фильтр по статусу: NEW | IN_PROGRESS | DONE. Так разработчик читает обращения.',
  })
  @ApiOkResponse({ description: 'Список обращений' })
  @AdminOnly()
  @Get()
  public async findAll(
    @Query('status') statusRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    const parsedLimit = Number.parseInt(limitRaw ?? '', 10);
    const parsedOffset = Number.parseInt(offsetRaw ?? '', 10);

    const status =
      statusRaw && statusRaw in FeedbackStatus
        ? (statusRaw as FeedbackStatus)
        : undefined;

    return this.feedbackService.findAll({
      status,
      limit: Number.isFinite(parsedLimit)
        ? Math.min(Math.max(parsedLimit, 1), MAX_LIMIT)
        : DEFAULT_LIMIT,
      offset: Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0,
    });
  }

  @ApiOperation({
    summary: 'Изменить статус обращения (администратор)',
  })
  @ApiOkResponse({ description: 'Статус обновлён' })
  @AdminOnly()
  @Patch(':id/status')
  public async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateFeedbackStatusDto,
  ) {
    return this.feedbackService.updateStatus(id, dto.status);
  }
}
