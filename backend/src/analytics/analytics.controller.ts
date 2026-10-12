import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto, ExportQueryDto } from './dto/analytics-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('api/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // Personal trading dashboard.
  @Get('me')
  getMyAnalytics(@Req() request, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getUserAnalytics(request.user.id, query);
  }

  // Download of the user's bets with the same filters (csv, json or pdf).
  @Get('me/export')
  async exportMyBets(
    @Req() request,
    @Query() query: ExportQueryDto,
    @Res() res: Response,
  ) {
    const file = await this.analyticsService.exportUserBets(
      request.user.id,
      request.user.username,
      query,
    );

    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Cache-Control': 'no-store',
    });
    res.send(file.body);
  }

  // Whole-platform statistics, only for administrators.
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('platform')
  getPlatformAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getPlatformAnalytics(query);
  }
}
