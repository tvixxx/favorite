import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ActorService } from './actor.service';
import { CreateActorDto } from './dto/create-actor.dto';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

@Controller('actors')
export class ActorController {
  constructor(private readonly actorService: ActorService) {}

  @Post()
  public create(@Body() dto: CreateActorDto) {
    return this.actorService.create(dto);
  }

  @Get()
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
  public findById(@Param('id') id: string) {
    return this.actorService.findById(id);
  }

  @Patch(':id')
  public patch(@Param('id') id: string, @Body() dto: Partial<CreateActorDto>) {
    return this.actorService.patch(id, dto);
  }
}
