import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { assertFeedbackEnabled } from '../common/utils/feedback-availability';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import {
  AuthCatalogWrite,
  AuthProtected,
  Authorized,
} from '../common/decorators';
import type { User } from '../generated/prisma/client';
import { MediaPurpose } from '../generated/prisma/enums';
import { MediaService } from './media.service';
import { MEDIA_POLICIES, type ImagePurpose } from './media-policy';
import { ImageUploadLimit } from './image-upload-limit.interceptor';

class UploadImageDto {
  @IsEnum(MediaPurpose)
  purpose: ImagePurpose;
}

@ApiTags('Media')
@Controller('uploads')
export class MediaController {
  constructor(
    private readonly media: MediaService,
    private readonly config: ConfigService,
  ) {}

  @Get('image-policy')
  public policy() {
    return MEDIA_POLICIES;
  }

  @AuthProtected()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Загрузить одно изображение' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'purpose'],
      properties: {
        file: { type: 'string', format: 'binary' },
        purpose: { type: 'string', enum: Object.keys(MEDIA_POLICIES) },
      },
    },
  })
  @UseInterceptors(
    ImageUploadLimit,
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 1, parts: 3 },
    }),
  )
  @Post('images')
  public upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadImageDto,
    @Authorized() user: User,
  ) {
    if (dto.purpose === 'FEEDBACK_SCREENSHOT') {
      assertFeedbackEnabled(this.config);
    }
    return this.media.upload(
      file?.buffer ?? Buffer.alloc(0),
      dto.purpose,
      user.id,
    );
  }

  @AuthCatalogWrite()
  @Delete('images/:id')
  @HttpCode(204)
  public discard(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Authorized() user: User,
  ) {
    return this.media.discard(id, user.id);
  }

  @AuthProtected()
  @Get('images/:id/:filename')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  public async privateImage(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('filename') filename: string,
    @Authorized() user: User,
  ): Promise<StreamableFile> {
    assertFeedbackEnabled(this.config);
    const bytes = await this.media.privateImage(id, filename, user);
    return new StreamableFile(bytes, {
      type: 'image/webp',
      disposition: 'inline',
      length: bytes.length,
    });
  }
}

@Controller('media/images')
export class LocalMediaController {
  constructor(private readonly media: MediaService) {}

  @Get(':id/:filename')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  @Header('X-Content-Type-Options', 'nosniff')
  public async image(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('filename') filename: string,
  ): Promise<StreamableFile> {
    const path = await this.media.localImage(id, filename);
    let size: number;

    try {
      size = (await stat(path)).size;
    } catch {
      throw new NotFoundException('Изображение не найдено');
    }

    return new StreamableFile(createReadStream(path), {
      type: 'image/webp',
      disposition: 'inline',
      length: size,
    });
  }
}
