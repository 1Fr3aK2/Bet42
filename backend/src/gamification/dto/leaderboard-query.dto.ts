import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { LeaderboardSort } from '../gamification.service';

export class LeaderboardQueryDto {
  @IsOptional()
  @IsIn(['balance', 'xp', 'wins'])
  sort?: LeaderboardSort;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
