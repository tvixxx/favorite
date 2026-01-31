import {
  Body,
  Controller,
  Get,
  Post,
  UseFilters,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { AppService } from './app.service';
import { StringToLowercasePipe } from './common/pipes';
import { UserAgent } from './common/decorators';
import { ResponseInterceptor } from './common/interceptors';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello() {
    return this.appService.getHello();
  }

  @UsePipes(StringToLowercasePipe)
  @Post()
  public create(@Body('title') title: string) {
    return `Movie ${title}`;
  }

  // @UseGuards(AuthGuard)
  // @UseInterceptors(ResponseInterceptor)
  // @Get('@me')
  // public profile(@UserAgent() userAgent: string) {
  //   return {
  //     id: 1,
  //     email: 'test@mail.ru',
  //     fullName: 'Admin',
  //     userAgent,
  //   };
  // }
}
