import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
  private owner(userId: string, user: { id: string }): string {
    if (userId !== user.id) throw new ForbiddenException();
    return user.id;
  }
  @Get()
  @Header('Cache-Control', 'private, no-store')
  public list(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Authorized() user: { id: string },
    @Query() query: DiaryQueryDto,
  ): Promise<DiaryPage> {
    return this.diary.list(this.owner(userId, user), query);
  }
  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  public create(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Authorized() user: { id: string },
    @Body() input: CreateDiaryDto,
  ): Promise<DiarySaveResult> {
    return this.diary.create(this.owner(userId, user), input);
  }
  @Patch(':id')
  @Header('Cache-Control', 'private, no-store')
  public update(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Authorized() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateDiaryDto,
  ): Promise<DiarySaveResult> {
    return this.diary.update(this.owner(userId, user), id, input);
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
    return this.diary.remove(this.owner(userId, user), id, query.revision);
  }
}
