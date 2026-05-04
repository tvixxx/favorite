import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  BadRequestException,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { MessageService } from './message.service';
import { AuthProtected } from '../common/decorators';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

type RequestWithUser = ExpressRequest & { user: { id: string } };

@ApiTags('Messages')
@Controller('users/:userId/messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Get('conversations')
  @AuthProtected()
  @ApiOperation({ summary: 'Get all conversations' })
  @ApiResponse({ status: 200, description: 'List of conversations' })
  async getConversations(
    @Param('userId') userId: string,
    @Request() req: RequestWithUser,
  ) {
    if (req.user.id !== userId) {
      throw new BadRequestException('Unauthorized');
    }

    return this.messageService.getConversations(userId);
  }

  @Get('unread/count')
  @AuthProtected()
  @ApiOperation({ summary: 'Get unread messages count' })
  @ApiResponse({ status: 200, description: 'Unread count' })
  async getUnreadCount(
    @Param('userId') userId: string,
    @Request() req: RequestWithUser,
  ) {
    if (req.user.id !== userId) {
      throw new BadRequestException('Unauthorized');
    }

    return this.messageService.getUnreadCount(userId);
  }

  @Get(':otherUserId')
  @AuthProtected()
  @ApiOperation({ summary: 'Get messages with specific user' })
  @ApiResponse({ status: 200, description: 'List of messages' })
  async getMessages(
    @Param('userId') userId: string,
    @Param('otherUserId') otherUserId: string,
    @Request() req: RequestWithUser,
    @Query('limit') limit?: string,
  ) {
    if (req.user.id !== userId) {
      throw new BadRequestException('Unauthorized');
    }

    return this.messageService.getMessages(
      userId,
      otherUserId,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
