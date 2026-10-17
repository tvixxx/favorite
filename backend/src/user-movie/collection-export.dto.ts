import { IsIn } from 'class-validator';
import { CollectionQueryDto } from './dto/collection-query.dto';

export class CollectionExportQueryDto extends CollectionQueryDto {
  @IsIn(['json', 'csv', 'pdf'])
  format: 'json' | 'csv' | 'pdf' = 'json';

  @IsIn(['all', 'filtered', 'completed'])
  scope: 'all' | 'filtered' | 'completed' = 'all';
}
