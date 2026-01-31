import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ActorService } from './actor.service';
import { CreateActorDto } from './dto/create-actor.dto';

@Controller('actors')
export class ActorController {
  constructor(private readonly actorService: ActorService) {}

  @Post()
  public create(@Body() dto: CreateActorDto) {
    return this.actorService.create(dto);
  }

  @Get()
  public findAll() {
    return this.actorService.findAll();
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
