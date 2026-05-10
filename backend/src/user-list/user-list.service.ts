import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddMovieToListDto,
  CreateUserListDto,
  UpdateUserListDto,
} from './dto';

@Injectable()
export class UserListService {
  constructor(private readonly prismaService: PrismaService) {}

  private normalizeName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private normalizeLabels(labels?: string[]): string[] {
    if (!labels?.length) {
      return [];
    }

    const unique = new Set<string>();

    for (const raw of labels) {
      const normalized = raw.trim();

      if (normalized) {
        unique.add(normalized);
      }
    }

    return Array.from(unique);
  }

  private async getOwnedList(userId: string, listId: string) {
    const list = await this.prismaService.userList.findFirst({
      where: {
        id: listId,
        userId,
      },
    });

    if (!list) {
      throw new NotFoundException('Список не найден');
    }

    return list;
  }

  public async findAllByUser(userId: string) {
    return this.prismaService.userList.findMany({
      where: { userId },
      include: {
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  public async findById(userId: string, listId: string) {
    const list = await this.prismaService.userList.findFirst({
      where: {
        id: listId,
        userId,
      },
      include: {
        items: {
          include: {
            movie: {
              include: {
                poster: true,
                actors: true,
              },
            },
          },
          orderBy: {
            addedAt: 'desc',
          },
        },
      },
    });

    if (!list) {
      throw new NotFoundException('Список не найден');
    }

    return list;
  }

  public async create(userId: string, dto: CreateUserListDto) {
    const normalizedName = this.normalizeName(dto.name);
    const labels = this.normalizeLabels(dto.labels);

    const existing = await this.prismaService.userList.findFirst({
      where: {
        userId,
        nameNormalized: normalizedName,
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Список с таким названием уже существует');
    }

    return this.prismaService.userList.create({
      data: {
        userId,
        name: dto.name.trim(),
        nameNormalized: normalizedName,
        description: dto.description?.trim() || null,
        labels,
      },
      include: {
        _count: {
          select: {
            items: true,
          },
        },
      },
    });
  }

  public async update(userId: string, listId: string, dto: UpdateUserListDto) {
    const list = await this.getOwnedList(userId, listId);

    let name = list.name;
    let nameNormalized = list.nameNormalized;

    if (dto.name !== undefined) {
      name = dto.name.trim();
      nameNormalized = this.normalizeName(dto.name);

      if (nameNormalized !== list.nameNormalized) {
        const existing = await this.prismaService.userList.findFirst({
          where: {
            userId,
            nameNormalized,
            NOT: {
              id: listId,
            },
          },
          select: { id: true },
        });

        if (existing) {
          throw new ConflictException('Список с таким названием уже существует');
        }
      }
    }

    return this.prismaService.userList.update({
      where: { id: listId },
      data: {
        name,
        nameNormalized,
        description: dto.description !== undefined ? dto.description.trim() : undefined,
        labels: dto.labels ? this.normalizeLabels(dto.labels) : undefined,
      },
      include: {
        _count: {
          select: {
            items: true,
          },
        },
      },
    });
  }

  public async delete(userId: string, listId: string) {
    await this.getOwnedList(userId, listId);

    await this.prismaService.userList.delete({
      where: { id: listId },
    });

    return true;
  }

  public async addMovie(userId: string, listId: string, dto: AddMovieToListDto) {
    await this.getOwnedList(userId, listId);

    const userMovie = await this.prismaService.userMovie.findUnique({
      where: {
        userId_movieId: {
          userId,
          movieId: dto.movieId,
        },
      },
      select: { movieId: true },
    });

    if (!userMovie) {
      throw new NotFoundException(
        'Фильм сначала нужно добавить в вашу коллекцию, затем в список',
      );
    }

    try {
      return await this.prismaService.userListItem.create({
        data: {
          listId,
          movieId: dto.movieId,
        },
        include: {
          movie: {
            include: {
              poster: true,
              actors: true,
            },
          },
        },
      });
    } catch (error: unknown) {
      const code = (error as { code?: string }).code;

      if (code === 'P2002') {
        throw new ConflictException('Фильм уже добавлен в этот список');
      }

      throw error;
    }
  }

  public async removeMovie(userId: string, listId: string, movieId: string) {
    await this.getOwnedList(userId, listId);

    const item = await this.prismaService.userListItem.findFirst({
      where: {
        listId,
        movieId,
      },
      select: {
        id: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Фильм не найден в этом списке');
    }

    await this.prismaService.userListItem.delete({
      where: {
        id: item.id,
      },
    });

    return true;
  }
}
