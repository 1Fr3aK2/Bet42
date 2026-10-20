import { BetDirection } from '@prisma/client';
import { IsEnum, IsIn, IsInt, Max, Min } from 'class-validator';
import {
  BET_DURATIONS,
  MAX_BET,
  MIN_BET,
  SUPPORTED_COINS,
} from '../bets.constants';

export class PlaceBetDto {
  @IsIn(SUPPORTED_COINS, {
    message: `coin must be one of: ${SUPPORTED_COINS.join(', ')}`,
  })
  coin: string;

  @IsEnum(BetDirection, { message: 'direction must be UP or DOWN' })
  direction: BetDirection;

  @IsInt({ message: 'amount must be a whole number of T$' })
  @Min(MIN_BET)
  @Max(MAX_BET)
  amount: number;

  @IsIn(BET_DURATIONS, {
    message: `duration must be one of: ${BET_DURATIONS.join(', ')} seconds`,
  })
  duration: number;
}
