import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateActorDto } from './dto/create-actor.dto';
import type { ActorsListResponseDto } from './dto/actors-list-response.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { Actor, Prisma } from '../generated/prisma/client';

@Injectable()
export class ActorService {
  constructor(private readonly prismaService: PrismaService) {}

  public async findMany(params: {
    q?: string;
    limit: number;
    offset: number;
  }): Promise<ActorsListResponseDto> {
    const { q, limit, offset } = params;
    const trimmed = q?.trim();

    const where: Prisma.ActorWhereInput = trimmed
      ? {
          name: {
            contains: trimmed,
            mode: 'insensitive',
          },
        }
      : {};

    const [items, total] = await Promise.all([
      this.prismaService.actor.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: offset,
        take: limit,
      }),
      this.prismaService.actor.count({ where }),
    ]);

    return { items, total, limit, offset };
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
