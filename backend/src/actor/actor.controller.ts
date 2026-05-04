import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ActorService } from './actor.service';
import { CreateActorDto } from './dto/create-actor.dto';
import { AuthCatalogWrite } from '../common/decorators';

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
  public create(@Body() dto: CreateActorDto) {
    return this.actorService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Список актёров' })
  @ApiOkResponse({ description: 'Страница' })
  public findAll(
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    const parsedLimit = Number.parseInt(limitRaw ?? '', 10);
    const parsedOffset = Number.parseInt(offsetRaw ?? '', 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;
    const offset = Number.isFinite(parsedOffset)
      ? Math.max(parsedOffset, 0)
      : 0;

    return this.actorService.findMany({ q, limit, offset });
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
    description: 'Любой залогиненный пользователь; лимит запросов',
  })
  @ApiNotFoundResponse()
  public patch(@Param('id') id: string, @Body() dto: Partial<CreateActorDto>) {
    return this.actorService.patch(id, dto);
  }
}
