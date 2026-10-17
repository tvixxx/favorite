import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PlainText } from '../common/validation/plain-text';

export class ChangeUserDto {
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsBoolean()
  blocked?: boolean;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsIn(['USER', 'ADMIN'])
  role?: 'USER' | 'ADMIN';

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  @PlainText({ multiline: true })
  reason!: string;
}

export class ModerateReviewDto {
  @IsBoolean()
  hidden!: boolean;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  @PlainText({ multiline: true })
  reason!: string;

  @IsISO8601()
  updatedAt!: string;
}

export class ReportReviewDto {
  @IsIn(['SPAM', 'ABUSE', 'SPOILER', 'OTHER'])
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @PlainText({ multiline: true })
  comment?: string;
}

export class UsageEventDto {
  @IsUUID('4')
  id!: string;

  @IsIn([
    'SEARCH',
    'MOVIE_VIEW',
    'COLLECTION_ADD',
    'RATING',
    'REVIEW',
    'LIST',
    'FEEDBACK',
  ])
  feature!: string;
}
