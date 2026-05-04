import { Injectable, NotFoundException } from '@nestjs/common';
import { hash } from 'argon2';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';

const publicUserSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  tags: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UserService {
  constructor(private readonly prismaService: PrismaService) {}

  public async findAll() {
    return this.prismaService.user.findMany({
      select: publicUserSelect,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  public async findById(id: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  public async findByEmail(email: string) {
    const user = await this.prismaService.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  public async create(dto: CreateUserDto) {
    const { email, fullName, tags, password } = dto;
    const hashedPass = await hash(password);

    return this.prismaService.user.create({
      data: {
        email,
        fullName,
        password: hashedPass,
        tags: tags as never,
      },
      select: publicUserSelect,
    });
  }

  public async update(id: string, dto: UpdateUserDto) {
    await this.findById(id);

    const { fullName, tags } = dto;

    return this.prismaService.user.update({
      where: { id },
      data: {
        fullName,
        tags: tags as never,
      },
      select: publicUserSelect,
    });
  }

  public async patch(
    id: string,
    dto: Partial<UpdateUserDto>,
    options?: { allowTags?: boolean },
  ) {
    await this.findById(id);

    const data: Partial<UpdateUserDto> = { ...dto };

    if (!options?.allowTags) {
      delete (data as { tags?: unknown }).tags;
    }

    return this.prismaService.user.update({
      where: { id },
      data: data as never,
      select: publicUserSelect,
    });
  }

  public async delete(id: string) {
    try {
      await this.prismaService.user.delete({
        where: { id },
      });

      return id;
    } catch (error: unknown) {
      const code = (error as { code?: string }).code;

      if (code === 'P2025') {
        throw new NotFoundException(`Пользователь с айди: ${id} не найден`);
      }

      throw error;
    }
  }
}
