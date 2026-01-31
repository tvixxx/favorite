import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  public create(@Body() dto: CreateReviewDto) {
    return this.reviewService.create(dto);
  }

  @Get(':id')
  public findById(@Param('id') id: string) {
    return this.reviewService.findById(id);
  }

  @Put(':id')
  public update(@Param('id') id: string, @Body() dto: CreateReviewDto) {
    return this.reviewService.update(id, dto);
  }
}
