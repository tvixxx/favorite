import { Injectable, NotFoundException } from '@nestjs/common';

import { CreateReviewDto } from './dto/create-review.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { Review } from '../generated/prisma/client';

@Injectable()
export class ReviewService {
  constructor(private readonly prismaService: PrismaService) {}

  public async create(dto: CreateReviewDto): Promise<Review> {
    const { movieId, text, rate } = dto;

    return this.prismaService.review.create({
      data: {
        text,
        rate,
        movie: {
          connect: {
            id: movieId,
          },
        },
      },
    });
  }

  public async findById(id: string): Promise<Review> {
    const review = await this.prismaService.review.findUnique({
      where: { id },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }

  public async update(id: string, dto: CreateReviewDto): Promise<Review> {
    const { movieId, text, rate } = dto;
    const movie = await this.prismaService.movie.findUnique({
      where: { id: movieId },
    });

    if (!movie) {
      throw new NotFoundException('Movie not found');
    }

    return this.prismaService.review.update({
      where: { id },
      data: {
        text,
        rate,
      },
    });
  }
}
