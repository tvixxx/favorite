import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ActorService } from './actor.service';
import { CreateActorDto, PatchActorDto } from './dto/create-actor.dto';
import { AuthCatalogWrite, Authorized } from '../common/decorators';
import type { User } from '../generated/prisma/client';
import {
  queryInteger,
  queryString,
  queryEnum,
} from '../common/utils/query-value';
import { isPlainText } from '../common/validation/plain-text';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

@ApiTags('Actors')
@Controller('actors')
export class ActorController {
  constructor(private readonly actorService: ActorService) {}

  @AuthCatalogWrite()
  @Post()
  @ApiOperation({
    summary: 'Создать актёра',
    description: 'Любой залогиненный пользователь; лимит запросов',
  })
  @ApiOkResponse({ description: 'Создано' })
  public create(@Body() dto: CreateActorDto, @Authorized() user: User) {
    return this.actorService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Список актёров' })
  @ApiOkResponse({ description: 'Страница' })
  public findAll(
    @Query('q') q?: unknown,
    @Query('limit') limitRaw?: unknown,
    @Query('offset') offsetRaw?: unknown,
    @Query('order') orderRaw?: unknown,
  ) {
    const limit = queryInteger(limitRaw, 'limit', DEFAULT_LIMIT, 1, MAX_LIMIT);
    const offset = queryInteger(offsetRaw, 'offset', 0, 0, 2147483647);
    const search = queryString(q, 'q');
    if (search && (search.length > 200 || !isPlainText(search)))
      throw new BadRequestException(
        'Поисковый запрос должен содержать не больше 200 символов без управляющих знаков',
      );

    return this.actorService.findMany({
      q: search,
      order: queryEnum(orderRaw, 'order', ['name', 'ru-first']),
      limit,
      offset,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Актёр по id' })
  @ApiNotFoundResponse({ description: 'Не найден' })
  public findById(@Param('id') id: string) {
    return this.actorService.findById(id);
  }

  @AuthCatalogWrite()
  @Patch(':id')
  @ApiOperation({
    summary: 'Обновить актёра',
    description:
      'Автор записи или администратор. Общие записи меняет только администратор.',
  })
  @ApiNotFoundResponse()
  public patch(
    @Param('id') id: string,
    @Body() dto: PatchActorDto,
    @Authorized() user: User,
  ) {
    return this.actorService.patch(id, dto, user);
  }
}
