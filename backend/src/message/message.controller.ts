import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { MessageService } from './message.service';
import { Authorization } from '../common/decorators/authorization.decorator';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Messages')
@Controller('users/:userId/messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Get('conversations')
  @Authorization()
  @ApiOperation({ summary: 'Get all conversations' })
  @ApiResponse({ status: 200, description: 'List of conversations' })
  async getConversations(@Param('userId') userId: string, @Request() req: any) {
    if (req.user.id !== userId) {
      throw new BadRequestException('Unauthorized');
    }
    return this.messageService.getConversations(userId);
  }

  @Get(':otherUserId')
  @Authorization()
  @ApiOperation({ summary: 'Get messages with specific user' })
  @ApiResponse({ status: 200, description: 'List of messages' })
  async getMessages(
    @Param('userId') userId: string,
    @Param('otherUserId') otherUserId: string,
    @Query('limit') limit?: string,
    @Request() req?: any,
  ) {
    if (req.user.id !== userId) {
      throw new BadRequestException('Unauthorized');
    }
    return this.messageService.getMessages(
      userId,
      otherUserId,
      limit ? parseInt(limit) : 50,
    );
  }

  @Get('unread/count')
  @Authorization()
  @ApiOperation({ summary: 'Get unread messages count' })
  @ApiResponse({ status: 200, description: 'Unread count' })
  async getUnreadCount(@Param('userId') userId: string, @Request() req: any) {
    if (req.user.id !== userId) {
      throw new BadRequestException('Unauthorized');
    }
    return this.messageService.getUnreadCount(userId);
  }
}
