import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  public findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  public findById(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Post()
  public create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Put(':id')
  public update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.userService.update(id, dto);
  }

  @Patch(':id')
  public patchUpdate(
    @Param('id') id: string,
    @Body() dto: Partial<UpdateUserDto>,
  ) {
    return this.userService.patch(id, dto);
  }

  @Delete(':id')
  public delete(@Param('id') id: string) {
    return this.userService.delete(id);
  }
}
