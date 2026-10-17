import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthProtected } from '../common/decorators/auth-protected.decorator';
import { AuthCatalogWrite } from '../common/decorators/auth-catalog-write.decorator';
import { Authorized } from '../common/decorators/authorized.decorator';
import { AuthOriginGuard } from '../common/guards/auth-origin.guard';
import type { CatalogUser } from '../common/utils/catalog-owner';
import { TvdbProvider } from './tvdb-provider';
import { TvdbImportService } from './tvdb-import.service';
import { TvdbIdentityDto, TvdbImportDto, TvdbSearchDto } from './tvdb.dto';

@Controller('catalog/tvdb')
export class TvdbController {
  constructor(
    private readonly provider: TvdbProvider,
    private readonly imports: TvdbImportService,
  ) {}
  @Get('capabilities')
  @Header('Cache-Control', 'no-store')
  capabilities() {
    return { enabled: this.provider.isAvailable() };
  }
  @Get('search')
  @AuthProtected()
  search(@Query() query: TvdbSearchDto, @Authorized() user: CatalogUser) {
    return this.imports.search(query.query, query.type, query.year, user);
  }
  @Get('preview')
  @AuthProtected()
  preview(@Query() query: TvdbIdentityDto, @Authorized() user: CatalogUser) {
    return this.imports.preview(query.type, query.id, user);
  }
  @Post('import')
  @AuthCatalogWrite()
  @UseGuards(AuthOriginGuard)
  importMovie(@Body() input: TvdbImportDto, @Authorized() user: CatalogUser) {
    return this.imports.importMovie(input, user);
  }
}
