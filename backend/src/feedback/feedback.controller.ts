import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { FeedbackQueryDto } from '../common/dto/list-query.dto';

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
  public async findAll(@Query() query: FeedbackQueryDto) {
    return this.feedbackService.findAll(query);
  }

  @ApiOperation({
    summary: 'Изменить статус обращения (администратор)',
  })
  @ApiOkResponse({ description: 'Статус обновлён' })
  @AdminOnly()
  @Patch(':id/status')
  public async updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFeedbackStatusDto,
    @Authorized() user: User,
  ) {
    return this.feedbackService.updateStatus(id, dto.status, user.id);
  }
}
