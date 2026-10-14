import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AdminOnly, AuthProtected, Authorized } from '../common/decorators';
import type { User } from '../generated/prisma/client';
import {
  queryEnum,
  queryInteger,
  queryString,
} from '../common/utils/query-value';
import { AdminService } from './admin.service';
import { ChangeUserDto, ModerateReviewDto, UsageEventDto } from './admin.dto';
import { AdminAnalyticsService } from './admin-analytics.service';
import { CatalogQueryDto, UsersQueryDto } from '../common/dto/list-query.dto';

@Controller('admin')
@AdminOnly()
export class AdminController {
  constructor(
    private readonly service: AdminService,
    private readonly analytics: AdminAnalyticsService,
  ) {}

  @Get('users')
  public users(@Query() query: UsersQueryDto, @Authorized() user: User) {
    return this.service.users(query, user.timezone);
  }

  @Patch('users/:id')
  public changeUser(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ChangeUserDto,
    @Authorized() user: User,
  ) {
    return this.service.changeUser(id, dto, user.id);
  }

  @Get('movies')
  public movies(@Query() query: CatalogQueryDto, @Authorized() user: User) {
    return this.service.movies(query, user.timezone);
  }

  @Get('reviews')
  public reviews(
    @Query('q') q?: unknown,
    @Query('limit') limit?: unknown,
    @Query('offset') offset?: unknown,
    @Query('scope') scope?: unknown,
  ) {
    return this.service.reviews({
      ...this.page(q, limit, offset),
      scope: queryEnum(scope, 'scope', ['reported', 'hidden']),
    });
  }

  @Patch('reviews/:id')
  public moderate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ModerateReviewDto,
    @Authorized() user: User,
  ) {
    return this.service.moderateReview(id, dto, user.id);
  }

  @Post('reviews/:id/dismiss-reports')
  public dismiss(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ChangeUserDto,
    @Authorized() user: User,
  ) {
    return this.service.dismissReports(id, dto.reason, user.id);
  }

  @Get('audit/:id')
  public audit(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.audit(id);
  }

  @Get('overview')
  public overview(@Query('days') days: unknown, @Authorized() user: User) {
    return this.analytics.overview(
      queryInteger(days, 'days', 30, 1, 90),
      user.timezone,
    );
  }

  private page(q: unknown, limit: unknown, offset: unknown) {
    return {
      q: queryString(q, 'q')?.trim().slice(0, 200),
      limit: queryInteger(limit, 'limit', 20, 1, 100),
      offset: queryInteger(offset, 'offset', 0, 0, 1_000_000),
    };
  }
}

@Controller('usage-events')
export class UsageController {
  constructor(private readonly analytics: AdminAnalyticsService) {}

  @Post()
  @AuthProtected()
  public record(@Body() dto: UsageEventDto, @Authorized() user: User) {
    return this.analytics.record(user.id, dto);
  }
}
