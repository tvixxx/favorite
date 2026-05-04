import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AdminOnly, AuthProtected, Authorized } from '../common/decorators';
import { UserRole } from '../generated/prisma/enums';
import type { User } from '../generated/prisma/client';

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @AdminOnly()
  @Get()
  @ApiOperation({ summary: 'Список пользователей (только ADMIN)' })
  @ApiResponse({ status: 200, description: 'Список' })
  @ApiForbiddenResponse({ description: 'Нет прав администратора' })
  public findAll() {
    return this.userService.findAll();
  }

  @AuthProtected()
  @Get('search')
  @ApiOperation({
    summary: 'Поиск пользователя по email',
    description: 'Нужен вход; для приглашения друзей',
  })
  @ApiNotFoundResponse({ description: 'Не найден' })
  public searchByEmail(@Query('email') email: string) {
    return this.userService.findByEmail(email);
  }

  @AuthProtected()
  @Get(':id')
  @ApiOperation({ summary: 'Профиль по id' })
  @ApiNotFoundResponse()
  public findById(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @AdminOnly()
  @Post()
  @ApiOperation({ summary: 'Создать пользователя (только ADMIN)' })
  @ApiForbiddenResponse()
  public create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @AdminOnly()
  @Put(':id')
  @ApiOperation({ summary: 'Полное обновление (только ADMIN)' })
  @ApiForbiddenResponse()
  public update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.userService.update(id, dto);
  }

  @AuthProtected()
  @Patch(':id')
  @ApiOperation({
    summary: 'Частичное обновление',
    description: 'Свой профиль (имя) или полный доступ для ADMIN',
  })
  @ApiForbiddenResponse()
  public patchUpdate(
    @Param('id') id: string,
    @Body() dto: Partial<UpdateUserDto>,
    @Authorized() user: User,
  ) {
    if (user.id !== id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Нельзя менять чужой профиль');
    }

    const isAdmin = user.role === UserRole.ADMIN;

    if (isAdmin) {
      return this.userService.patch(id, dto, { allowTags: true });
    }

    if (dto.tags !== undefined) {
      throw new ForbiddenException('Менять теги может только администратор');
    }

    return this.userService.patch(id, { fullName: dto.fullName } as never);
  }

  @AdminOnly()
  @Delete(':id')
  @ApiOperation({ summary: 'Удалить пользователя (только ADMIN)' })
  @ApiForbiddenResponse()
  public delete(@Param('id') id: string) {
    return this.userService.delete(id);
  }
}
