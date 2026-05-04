import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FriendshipService } from './friendship.service';
import { CreateFriendshipDto } from './dto';
import { AuthProtected } from '../common/decorators';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Friendship')
@Controller('users/:userId/friends')
export class FriendshipController {
  constructor(private readonly friendshipService: FriendshipService) {}

  @Post('request')
  @AuthProtected()
  @ApiOperation({ summary: 'Send friend request or subscribe' })
  @ApiResponse({ status: 201, description: 'Request sent successfully' })
  async sendRequest(
    @Param('userId') userId: string,
    @Body() dto: CreateFriendshipDto,
    @Request() req: any,
  ) {
    if (req.user.id !== userId) {
      throw new BadRequestException('Unauthorized');
    }
    return this.friendshipService.sendRequest(userId, dto);
  }

  @Patch(':friendshipId/accept')
  @AuthProtected()
  @ApiOperation({ summary: 'Accept friend request' })
  @ApiResponse({ status: 200, description: 'Request accepted' })
  async acceptRequest(
    @Param('userId') userId: string,
    @Param('friendshipId') friendshipId: string,
    @Request() req: any,
  ) {
    if (req.user.id !== userId) {
      throw new BadRequestException('Unauthorized');
    }
    return this.friendshipService.acceptRequest(userId, friendshipId);
  }

  @Patch(':friendshipId/reject')
  @AuthProtected()
  @ApiOperation({ summary: 'Reject friend request' })
  @ApiResponse({ status: 200, description: 'Request rejected' })
  async rejectRequest(
    @Param('userId') userId: string,
    @Param('friendshipId') friendshipId: string,
    @Request() req: any,
  ) {
    if (req.user.id !== userId) {
      throw new BadRequestException('Unauthorized');
    }
    return this.friendshipService.rejectRequest(userId, friendshipId);
  }

  @Delete(':friendshipId')
  @AuthProtected()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove friendship or unsubscribe' })
  @ApiResponse({ status: 204, description: 'Friendship removed' })
  async removeFriendship(
    @Param('userId') userId: string,
    @Param('friendshipId') friendshipId: string,
    @Request() req: any,
  ) {
    if (req.user.id !== userId) {
      throw new BadRequestException('Unauthorized');
    }
    return this.friendshipService.removeFriendship(friendshipId, userId);
  }

  @Get()
  @AuthProtected()
  @ApiOperation({ summary: 'Get user friends' })
  @ApiResponse({ status: 200, description: 'List of friends' })
  async getFriends(@Param('userId') userId: string, @Request() req: any) {
    if (req.user.id !== userId) {
      throw new BadRequestException('Unauthorized');
    }
    return this.friendshipService.getFriends(userId);
  }

  @Get('subscribers')
  @AuthProtected()
  @ApiOperation({ summary: 'Get user subscribers' })
  @ApiResponse({ status: 200, description: 'List of subscribers' })
  async getSubscribers(@Param('userId') userId: string, @Request() req: any) {
    if (req.user.id !== userId) {
      throw new BadRequestException('Unauthorized');
    }
    return this.friendshipService.getSubscribers(userId);
  }

  @Get('subscriptions')
  @AuthProtected()
  @ApiOperation({ summary: 'Get user subscriptions' })
  @ApiResponse({ status: 200, description: 'List of subscriptions' })
  async getSubscriptions(@Param('userId') userId: string, @Request() req: any) {
    if (req.user.id !== userId) {
      throw new BadRequestException('Unauthorized');
    }
    return this.friendshipService.getSubscriptions(userId);
  }

  @Get('requests')
  @AuthProtected()
  @ApiOperation({ summary: 'Get incoming friend requests' })
  @ApiResponse({ status: 200, description: 'List of incoming requests' })
  async getRequests(@Param('userId') userId: string, @Request() req: any) {
    if (req.user.id !== userId) {
      throw new BadRequestException('Unauthorized');
    }
    return this.friendshipService.getRequests(userId);
  }

  @Get('stats')
  @AuthProtected()
  @ApiOperation({ summary: 'Get friendship statistics' })
  @ApiResponse({ status: 200, description: 'Friendship stats' })
  async getStats(@Param('userId') userId: string, @Request() req: any) {
    if (req.user.id !== userId) {
      throw new BadRequestException('Unauthorized');
    }
    return this.friendshipService.getStats(userId);
  }
}
