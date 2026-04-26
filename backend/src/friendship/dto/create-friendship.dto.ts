import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';

export enum FriendshipTypeDto {
  FRIEND_REQUEST = 'FRIEND_REQUEST',
  SUBSCRIPTION = 'SUBSCRIPTION',
}

export class CreateFriendshipDto {
  @ApiProperty({
    description: 'ID пользователя, которому отправляется запрос/подписка',
    example: 'dad213-dad21-d1213-dokojp2',
  })
  @IsUUID('4')
  addresseeId: string;

  @ApiProperty({
    description: 'Тип отношения',
    enum: FriendshipTypeDto,
    example: FriendshipTypeDto.FRIEND_REQUEST,
  })
  @IsEnum(FriendshipTypeDto)
  type: FriendshipTypeDto;
}
