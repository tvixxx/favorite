import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateActorDto } from './dto/create-actor.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { Actor } from '../generated/prisma/client';

@Injectable()
export class ActorService {
  constructor(private readonly prismaService: PrismaService) {}

  public async findAll(): Promise<Actor[]> {
    return this.prismaService.actor.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  public async findById(id: string) {
    const actor = await this.prismaService.actor.findUnique({
      where: {
        id,
      },
    });

    if (!actor) {
      throw new NotFoundException('Actor not found');
    }

    return actor;
  }

  public async patch(
    id: string,
    dto: Partial<CreateActorDto>,
  ): Promise<boolean> {
    await this.prismaService.actor.update({
      where: { id },
      data: {
        name: dto.name,
      },
    });

    return true;
  }

  public async create(createActorDto: CreateActorDto): Promise<Actor> {
    const { name } = createActorDto;

    return this.prismaService.actor.create({ data: { name } });
  }
}
