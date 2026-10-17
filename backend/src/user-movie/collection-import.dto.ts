import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  ValidateIf,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { MAX_SNAPSHOT_BYTES, MAX_SNAPSHOT_ROWS } from './collection-file';

export class CollectionMatchDto {
  @IsInt()
  @Min(1)
  @Max(MAX_SNAPSHOT_ROWS)
  row: number;

  @IsUUID('4')
  movieId: string;
}

export class CheckCollectionImportDto {
  @ApiProperty({ enum: ['csv', 'json'] })
  @IsIn(['csv', 'json'])
  format: 'csv' | 'json';

  @ApiProperty({
    description: 'UTF-8 содержимое файла: v1 до 32 КиБ, v2 до 2 МиБ',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_SNAPSHOT_BYTES)
  content: string;

  @ApiPropertyOptional({ type: [CollectionMatchDto] })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(MAX_SNAPSHOT_ROWS)
  @ValidateNested({ each: true })
  @Type(() => CollectionMatchDto)
  matches?: CollectionMatchDto[];
}
export class CommitCollectionImportDto extends CheckCollectionImportDto {
  @ApiProperty({ description: 'Подтверждение серверной проверки' })
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  proof: string;
}
