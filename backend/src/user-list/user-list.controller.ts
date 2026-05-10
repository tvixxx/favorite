import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthProtected, Authorized } from '../common/decorators';
import type { User } from '../generated/prisma/client';
import { UserListService } from './user-list.service';
import { AddMovieToListDto, CreateUserListDto, UpdateUserListDto } from './dto';

@ApiTags('User Lists')
@Controller('users/:userId/lists')
export class UserListController {
  constructor(private readonly userListService: UserListService) {}

  private ensureSelf(paramUserId: string, user: { id: string }): void {
    if (paramUserId !== user.id) {
      throw new ForbiddenException();
    }
  }

  @ApiOperation({
    summary: 'Получить пользовательские списки',
    description: 'Возвращает списки текущего пользователя',
  })
  @ApiOkResponse({ description: 'Списки найдены' })
  @AuthProtected()
  @Get()
  public findAll(@Param('userId') userId: string, @Authorized() user: User) {
    this.ensureSelf(userId, user);

    return this.userListService.findAllByUser(userId);
  }

  @ApiOperation({
    summary: 'Получить один список',
    description: 'Возвращает список с фильмами',
  })
  @ApiOkResponse({ description: 'Список найден' })
  @ApiNotFoundResponse({ description: 'Список не найден' })
  @AuthProtected()
  @Get(':listId')
  public findById(
    @Param('userId') userId: string,
    @Param('listId') listId: string,
    @Authorized() user: User,
  ) {
    this.ensureSelf(userId, user);

    return this.userListService.findById(userId, listId);
  }

  @ApiOperation({
    summary: 'Создать список',
    description: 'Создает пользовательский список с опциональными метками',
  })
  @ApiOkResponse({ description: 'Список создан' })
  @ApiConflictResponse({ description: 'Список с таким названием уже существует' })
  @AuthProtected()
  @Post()
  public create(
    @Param('userId') userId: string,
    @Body() dto: CreateUserListDto,
    @Authorized() user: User,
  ) {
    this.ensureSelf(userId, user);

    return this.userListService.create(userId, dto);
  }

  @ApiOperation({
    summary: 'Изменить список',
    description: 'Обновляет название, описание и метки списка',
  })
  @ApiOkResponse({ description: 'Список обновлен' })
  @ApiNotFoundResponse({ description: 'Список не найден' })
  @ApiConflictResponse({ description: 'Список с таким названием уже существует' })
  @AuthProtected()
  @Patch(':listId')
  public update(
    @Param('userId') userId: string,
    @Param('listId') listId: string,
    @Body() dto: UpdateUserListDto,
    @Authorized() user: User,
  ) {
    this.ensureSelf(userId, user);

    return this.userListService.update(userId, listId, dto);
  }

  @ApiOperation({
    summary: 'Удалить список',
    description: 'Удаляет пользовательский список',
  })
  @ApiOkResponse({ description: 'Список удален' })
  @ApiNotFoundResponse({ description: 'Список не найден' })
  @AuthProtected()
  @Delete(':listId')
  public delete(
    @Param('userId') userId: string,
    @Param('listId') listId: string,
    @Authorized() user: User,
  ) {
    this.ensureSelf(userId, user);

    return this.userListService.delete(userId, listId);
  }

  @ApiOperation({
    summary: 'Добавить фильм в список',
    description:
      'Фильм должен быть в коллекции пользователя, затем его можно добавить в список',
  })
  @ApiOkResponse({ description: 'Фильм добавлен в список' })
  @ApiNotFoundResponse({
    description: 'Список или фильм в коллекции пользователя не найден',
  })
  @ApiConflictResponse({ description: 'Фильм уже есть в списке' })
  @AuthProtected()
  @Post(':listId/movies')
  public addMovie(
    @Param('userId') userId: string,
    @Param('listId') listId: string,
    @Body() dto: AddMovieToListDto,
    @Authorized() user: User,
  ) {
    this.ensureSelf(userId, user);

    return this.userListService.addMovie(userId, listId, dto);
  }

  @ApiOperation({
    summary: 'Удалить фильм из списка',
    description: 'Удаляет фильм из выбранного пользовательского списка',
  })
  @ApiOkResponse({ description: 'Фильм удален из списка' })
  @ApiNotFoundResponse({ description: 'Список или фильм в списке не найден' })
  @AuthProtected()
  @Delete(':listId/movies/:movieId')
  public removeMovie(
    @Param('userId') userId: string,
    @Param('listId') listId: string,
    @Param('movieId') movieId: string,
    @Authorized() user: User,
  ) {
    this.ensureSelf(userId, user);

    return this.userListService.removeMovie(userId, listId, movieId);
  }
}
