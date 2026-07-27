import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { FeedbackStatus } from '../../generated/prisma/enums';

export class UpdateFeedbackStatusDto {
  @ApiProperty({
    enum: FeedbackStatus,
    description: 'Новый статус обращения',
    example: FeedbackStatus.IN_PROGRESS,
  })
  @IsEnum(FeedbackStatus)
  status: FeedbackStatus;
}
