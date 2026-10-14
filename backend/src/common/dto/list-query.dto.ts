import { BadRequestException } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ZonedCalendar } from '../utils/timezone';

export class ListQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @MaxLength(200)
  q?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  offset = 0;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsISO8601({ strict: true })
  to?: string;

  @IsOptional()
  @IsIn(['newest', 'oldest'])
  sort?: 'newest' | 'oldest';
}

export class UsersQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(['USER', 'ADMIN'])
  role?: 'USER' | 'ADMIN';

  @IsOptional()
  @IsIn(['active', 'blocked'])
  state?: 'active' | 'blocked';
}

export class CatalogQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(['film', 'serial'])
  kind?: 'film' | 'serial';

  @IsOptional()
  @IsIn(['poster', 'date', 'actors'])
  quality?: 'poster' | 'date' | 'actors';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  author?: string;
}

export class FeedbackQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(['NEW', 'IN_PROGRESS', 'DONE'])
  status?: 'NEW' | 'IN_PROGRESS' | 'DONE';

  @IsOptional()
  @IsIn(['BUG', 'IDEA', 'OTHER'])
  type?: 'BUG' | 'IDEA' | 'OTHER';
}

export function createdAtRange(
  query: {
    from?: string;
    to?: string;
  },
  timezone = 'UTC',
): { gte?: Date; lt?: Date } | undefined {
  if (query.from && query.to && query.from > query.to) {
    throw new BadRequestException('Начало периода позже окончания');
  }

  if (!query.from && !query.to) {
    return undefined;
  }

  const calendar = new ZonedCalendar(timezone);
  return {
    ...(query.from ? { gte: calendar.startOfDay(query.from) } : {}),
    ...(query.to
      ? {
          lt: calendar.startOfDay(calendar.addDays(query.to, 1)),
        }
      : {}),
  };
}
