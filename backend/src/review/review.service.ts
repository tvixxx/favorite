import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { Review } from '../generated/prisma/client';
import { lockResource } from '../common/utils/transaction-lock';

@Injectable()
export class ReviewService {
  constructor(private readonly prismaService: PrismaService) {}

  public async create(dto: CreateReviewDto, userId: string): Promise<Review> {
    const { movieId, text, rate } = dto;

    return this.prismaService.$transaction(async (tx) => {
      await lockResource(tx, `collection:${userId}:${movieId}`);
      const existing = await tx.review.findFirst({
        where: { userId, movieId },
      });

      if (existing) {
        throw new ConflictException(
          'Вы уже оставили отзыв. Отредактируйте существующий.',
        );
      }

      return tx.review.create({
        data: {
          text,
          rate,
          user: {
            connect: {
              id: userId,
            },
          },
          movie: {
            connect: {
              id: movieId,
            },
          },
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      });
    });
  }

  public async findById(id: string): Promise<Review> {
    const review = await this.prismaService.review.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }

  public findMine(movieId: string, userId: string): Promise<Review | null> {
    return this.prismaService.review.findFirst({
      where: { movieId, userId },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, fullName: true } } },
    });
  }

  public async update(
    id: string,
    dto: UpdateReviewDto,
    userId: string,
  ): Promise<Review> {
    const { text, rate } = dto;
    const existing = await this.prismaService.review.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Review not found');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException();
    }

    return this.prismaService.review.update({
      where: { id },
      data: {
        text,
        rate,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });
  }

  public async delete(id: string, userId: string): Promise<string> {
    const existing = await this.prismaService.review.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Ревью с айди: ${id} не найдено`);
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException();
    }

    try {
      await this.prismaService.review.delete({
        where: { id },
      });

      return id;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Ревью с айди: ${id} не найдено`);
      }

      throw error;
    }
  }
}
