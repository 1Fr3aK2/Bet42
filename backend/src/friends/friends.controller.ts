import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth-guard';
import { FriendsService } from './friends.service';
import { SendFriendRequestDto } from './dto/send-friend-request.dto';

@UseGuards(JwtAuthGuard)
@Controller('api/friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  // { friends, incoming, outgoing }, each friend with its online status
  @Get()
  list(@Req() request) {
    return this.friendsService.list(request.user.id);
  }

  @Get('relationship/:userId')
  relationship(@Req() request, @Param('userId', ParseIntPipe) userId: number) {
    return this.friendsService.relationship(request.user.id, userId);
  }

  @Post('requests')
  sendRequest(@Req() request, @Body() dto: SendFriendRequestDto) {
    return this.friendsService.sendRequest(request.user.id, dto);
  }

  @Post('requests/:id/accept')
  accept(@Req() request, @Param('id', ParseIntPipe) id: number) {
    return this.friendsService.accept(request.user.id, id);
  }

  // Decline (receiver) or cancel (sender) a pending request
  @Delete('requests/:id')
  deleteRequest(@Req() request, @Param('id', ParseIntPipe) id: number) {
    return this.friendsService.deleteRequest(request.user.id, id);
  }

  @Delete(':userId')
  removeFriend(@Req() request, @Param('userId', ParseIntPipe) userId: number) {
    return this.friendsService.removeFriend(request.user.id, userId);
  }
}
