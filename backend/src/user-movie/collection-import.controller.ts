import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthProtected, Authorized } from '../common/decorators';
import type { User } from '../generated/prisma/client';
import { CollectionImportService } from './collection-import.service';
import {
  CheckCollectionImportDto,
  CommitCollectionImportDto,
} from './collection-import.dto';

@ApiTags('User Movies')
@Controller('users/:userId/movies/import')
export class CollectionImportController {
  constructor(private readonly imports: CollectionImportService) {}
  private self(id: string, user: User) {
    if (id !== user.id) throw new ForbiddenException();
  }

  @AuthProtected()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('check')
  @HttpCode(200)
  @ApiOperation({ summary: 'Проверить файл коллекции без сохранения' })
  public check(
    @Param('userId') id: string,
    @Authorized() user: User,
    @Body() dto: CheckCollectionImportDto,
  ) {
    this.self(id, user);
    return this.imports.check(user, dto);
  }

  @AuthProtected()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post()
  @ApiOperation({ summary: 'Импортировать проверенный файл одной транзакцией' })
  public commit(
    @Param('userId') id: string,
    @Authorized() user: User,
    @Body() dto: CommitCollectionImportDto,
  ) {
    this.self(id, user);
    return this.imports.commit(user, dto);
  }
}
