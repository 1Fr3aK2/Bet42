import { Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth-guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { GamificationService } from './gamification.service';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';

@Controller('api')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  // XP, level, streaks, daily bonus state and achievements of the logged-in user.
  @UseGuards(JwtAuthGuard)
  @Get('gamification/me')
  getMyProgress(@Req() request) {
    return this.gamificationService.getProgress(request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('gamification/daily-bonus')
  claimDailyBonus(@Req() request) {
    return this.gamificationService.claimDailyBonus(request.user.id);
  }

  @Get('gamification/achievements')
  getAchievements() {
    return this.gamificationService.getAchievementCatalog();
  }

  // Public ranking. When logged in, `me` contains the user's own rank.
  @UseGuards(OptionalJwtAuthGuard)
  @Get('leaderboard')
  getLeaderboard(@Req() request, @Query() query: LeaderboardQueryDto) {
    return this.gamificationService.getLeaderboard(
      query.sort ?? 'balance',
      query.limit ?? 50,
      request.user?.id,
    );
  }
}
