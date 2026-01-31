import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prismaService: PrismaService) {}

  public async findAll() {
    return this.prismaService.user.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  public async findById(id: string) {
    const user = await this.prismaService.user.findUnique({
      where: {
        id,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  public async create(dto: CreateUserDto) {
    const { email, fullName, tags, password } = dto;

    return this.prismaService.user.create({
      data: {
        email,
        fullName,
        password,
        tags: tags as any,
      },
    });
  }

  public async update(id: string, dto: UpdateUserDto) {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    const { fullName, tags } = dto;

    return this.prismaService.user.update({
      where: {
        id,
      },
      data: {
        ...user,
        fullName,
        tags: tags as any, // improve later
      },
    });
  }

  public async patch(id: string, dto: Partial<UpdateUserDto>) {
    const updatedData: any = { ...dto };

    return this.prismaService.user.update({
      where: {
        id,
      },
      data: updatedData,
    });
  }

  public async delete(id: string) {
    try {
      await this.prismaService.user.delete({
        where: {
          id,
        },
      });

      return id;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Пользователь с айди: ${id} не найден`);
      }

      throw error;
    }
  }
}
