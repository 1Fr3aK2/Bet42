import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth-guard';
import { BetsService } from './bets.service';
import { PlaceBetDto } from './dto/place-bet.dto';
import { ListBetsDto } from './dto/list-bets.dto';

@Controller('api/bets')
export class BetsController {
  constructor(private readonly betsService: BetsService) {}

  // Public: coins, durations, payout... so the UI does not hardcode them.
  @Get('rules')
  getRules() {
    return this.betsService.getRules();
  }

  // Public: latest bets of all players (live activity feed).
  @Get('feed')
  getFeed() {
    return this.betsService.recentActivity();
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  placeBet(@Req() request, @Body() dto: PlaceBetDto) {
    return this.betsService.placeBet(request.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('active')
  getActiveBets(@Req() request) {
    return this.betsService.activeBets(request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  listBets(@Req() request, @Query() query: ListBetsDto) {
    return this.betsService.listBets(request.user.id, query);
  }
}
