import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthProtected, Authorized } from '../common/decorators';
import { requireOwner } from '../common/utils/require-owner';
import { AuthOriginGuard } from '../common/guards/auth-origin.guard';
import { WatchDiaryService } from './watch-diary.service';
import {
  CreateDiaryDto,
  DeleteDiaryDto,
  DiaryQueryDto,
  UpdateDiaryDto,
} from './watch-diary.dto';
import type { DiaryPage, DiarySaveResult } from './diary.types';

@Controller('users/:userId/watch-diary')
@AuthProtected()
@UseGuards(AuthOriginGuard)
export class WatchDiaryController {
  constructor(private readonly diary: WatchDiaryService) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  public list(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Authorized() user: { id: string },
    @Query() query: DiaryQueryDto,
  ): Promise<DiaryPage> {
    return this.diary.list(requireOwner(userId, user), query);
  }
  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  public create(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Authorized() user: { id: string },
    @Body() input: CreateDiaryDto,
  ): Promise<DiarySaveResult> {
    return this.diary.create(requireOwner(userId, user), input);
  }
  @Patch(':id')
  @Header('Cache-Control', 'private, no-store')
  public update(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Authorized() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateDiaryDto,
  ): Promise<DiarySaveResult> {
    return this.diary.update(requireOwner(userId, user), id, input);
  }
  @Delete(':id')
  @HttpCode(204)
  @Header('Cache-Control', 'private, no-store')
  public remove(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Authorized() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DeleteDiaryDto,
  ): Promise<void> {
    return this.diary.remove(requireOwner(userId, user), id, query.revision);
  }
}
