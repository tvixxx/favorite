import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckCollectionImportDto {
  @ApiProperty({ enum: ['csv', 'json'] })
  @IsIn(['csv', 'json'])
  format: 'csv' | 'json';

  @ApiProperty({ description: 'UTF-8 содержимое файла, до 32 КБ' })
  @IsString()
  @MinLength(1)
  @MaxLength(32768)
  content: string;
}
export class CommitCollectionImportDto extends CheckCollectionImportDto {
  @ApiProperty({ description: 'Подтверждение серверной проверки' })
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  proof: string;
}
