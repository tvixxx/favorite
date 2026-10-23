import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateBy,
  ValidateNested,
} from 'class-validator';
import { PlainText } from '../common/validation/plain-text';

const uuid =
  '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const route = new RegExp(
  '^/(?:notifications(?:\\?section=(?:people|system))?|friends(?:\\?tab=(?:friends|requests|subscribers|subscriptions))?|library(?:/(?:collection|catalog|actors|lists|diary))?|favorites|profile|leaderboard(?:/(?:users|movies))?|detail/' +
    uuid +
    '|chat(?:/' +
    uuid +
    ')?)?$',
);

export function isAnnouncementPath(value: unknown): value is string {
  return typeof value === 'string' && route.test(value);
}

export class AnnouncementActionDto {
  @IsString()
  @PlainText()
  @MinLength(1)
  @MaxLength(40)
  label: string;

  @ValidateBy({
    name: 'announcementPath',
    validator: {
      validate: isAnnouncementPath,
      defaultMessage: () => 'Разрешён только поддерживаемый внутренний маршрут',
    },
  })
  path: string;
}

class AnnouncementContentDto {
  @IsString()
  @PlainText()
  @MinLength(1)
  @MaxLength(120)
  title: string;

  @IsString()
  @PlainText({ multiline: true })
  @MinLength(1)
  @MaxLength(5000)
  body: string;

  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => AnnouncementActionDto)
  actions: AnnouncementActionDto[] = [];
}

export class AnnouncementDraftDto extends AnnouncementContentDto {
  @IsIn(['NEWS', 'SERVICE'])
  category: 'NEWS' | 'SERVICE';
}

export class ReleaseNoteDto extends AnnouncementContentDto {
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9.-]{0,79}$/)
  id: string;
}
