import { BetDirection } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsOptional } from 'class-validator';
import { BET_DURATIONS, SUPPORTED_COINS } from '../../bets/bets.constants';

// Filters shared by the dashboard and the exports.
// Dates are YYYY-MM-DD (whole UTC days) or full ISO timestamps.
export class AnalyticsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(SUPPORTED_COINS)
  coin?: string;

  @IsOptional()
  @Type(() => Number)
  @IsIn(BET_DURATIONS)
  duration?: number;

  @IsOptional()
  @IsEnum(BetDirection)
  direction?: BetDirection;
}

export const EXPORT_FORMATS = ['csv', 'json', 'pdf'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export class ExportQueryDto extends AnalyticsQueryDto {
  @IsIn(EXPORT_FORMATS)
  format: ExportFormat;
}
