import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ListQueryDto } from '../common/dto/list-query.dto';
import { PlainText } from '../common/validation/plain-text';
import type { DiaryValuesInput } from './diary-values';

export class DiaryFieldsDto implements DiaryValuesInput {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  public viewedOn: string;

  @IsIn(['TITLE', 'SEASON'])
  public scope: 'TITLE' | 'SEASON' = 'TITLE';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  public season?: number | null;

  @IsBoolean()
  public isRewatch = false;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  public rating?: number | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(500)
  @PlainText({ multiline: true })
  public note?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  public allowDuplicate?: boolean;
}
export class CreateDiaryDto extends DiaryFieldsDto {
  @IsUUID()
  public movieId: string;
  @IsUUID()
  public requestId: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  public syncStatus?: boolean;
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  public syncRating?: boolean;
}
export class UpdateDiaryDto extends DiaryFieldsDto {
  @IsInt()
  @Min(1)
  public revision: number;
}
export class DeleteDiaryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public revision: number;
}
export class DiaryQueryDto extends ListQueryDto {
  @IsOptional()
  @IsUUID()
  public movieId?: string;
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  public isRewatch?: boolean;
}
