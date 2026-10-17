import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Matches,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { PlainText } from '../../common/validation/plain-text';

export class CreateActorDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/\S/)
  @PlainText()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsUUID('4')
  imageAssetId?: string | null;

  @IsOptional()
  @MaxLength(2048)
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: false,
  })
  imageUrl?: string | null;
}

export class PatchActorDto extends PartialType(CreateActorDto, {
  skipNullProperties: false,
}) {}
