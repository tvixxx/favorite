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
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
import { queryEnum, queryInteger } from '../common/utils/query-value';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

@ApiTags('Feedback')
@Controller('feedback')
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
    @Query('status') statusRaw?: unknown,
    @Query('limit') limitRaw?: unknown,
    @Query('offset') offsetRaw?: unknown,
  ) {
    const status = queryEnum(
      statusRaw,
      'status',
      Object.values(FeedbackStatus),
    );

    return this.feedbackService.findAll({
      status,
      limit: queryInteger(limitRaw, 'limit', DEFAULT_LIMIT, 1, MAX_LIMIT),
      offset: queryInteger(offsetRaw, 'offset', 0, 0, 2147483647),
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
