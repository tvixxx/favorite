import { Module } from '@nestjs/common';
import { MediaController, LocalMediaController } from './media.controller';
import { MediaService } from './media.service';
import { ImageStorage } from './image-storage.service';
import { ImageProcessor } from './image-processor.service';
import { ImageUploadLimit } from './image-upload-limit.interceptor';

@Module({
  controllers: [MediaController, LocalMediaController],
  providers: [MediaService, ImageStorage, ImageProcessor, ImageUploadLimit],
  exports: [MediaService],
})
export class MediaModule {}
