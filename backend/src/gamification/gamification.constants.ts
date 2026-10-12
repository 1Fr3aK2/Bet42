export interface AchievementDefinition {
  code: string;
  name: string;
  description: string;
  icon: string;
  xpReward: number;
}

// Single source of truth for achievements. GamificationService copies this
// list into the Achievement table on startup.
export const ACHIEVEMENTS: AchievementDefinition[] = [
  { code: 'FIRST_BET', name: 'First Trade', description: 'Place your first bet.', icon: '🎯', xpReward: 25 },
  { code: 'FIRST_WIN', name: 'First Win', description: 'Win your first bet.', icon: '🏆', xpReward: 25 },
  { code: 'BETS_10', name: 'Regular Trader', description: 'Place 10 bets.', icon: '📈', xpReward: 50 },
  { code: 'BETS_50', name: 'Veteran Trader', description: 'Place 50 bets.', icon: '🎖️', xpReward: 150 },
  { code: 'STREAK_3', name: 'Hot Hand', description: 'Win 3 bets in a row.', icon: '🔥', xpReward: 75 },
  { code: 'STREAK_5', name: 'Unstoppable', description: 'Win 5 bets in a row.', icon: '⚡', xpReward: 200 },
  { code: 'HIGH_ROLLER', name: 'High Roller', description: 'Place a single bet of 1,000 T$ or more.', icon: '💎', xpReward: 50 },
  { code: 'PATIENT', name: 'Patient Trader', description: 'Win a 5-minute bet.', icon: '⏳', xpReward: 50 },
  { code: 'DIVERSIFIED', name: 'Diversified', description: 'Bet on both BTC and ETH.', icon: '🪙', xpReward: 25 },
  { code: 'DAILY_3', name: 'Creature of Habit', description: 'Claim the daily bonus 3 days in a row.', icon: '📅', xpReward: 75 },
  { code: 'LEVEL_5', name: 'Rising Star', description: 'Reach level 5.', icon: '⭐', xpReward: 100 },
  { code: 'BALANCE_5000', name: 'Whale', description: 'Reach a balance of 5,000 T$.', icon: '🐋', xpReward: 150 },
];

// XP rules
export const XP_PER_BET = 5;
export const XP_PER_WIN = 15;

// Daily bonus: once per UTC day. Claiming on consecutive days grows the streak.
export const DAILY_BONUS_AMOUNT = 100;
export const DAILY_BONUS_XP = 10;

// Levels: going from level n to n + 1 costs n × 100 XP,
// so reaching level L needs 50 × L × (L − 1) XP in total
// (level 2 = 100 XP, level 3 = 300 XP, level 4 = 600 XP, level 5 = 1000 XP).
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export function levelForXp(xp: number): number {
  return Math.floor((1 + Math.sqrt(1 + (8 * Math.max(0, xp)) / 100)) / 2);
}

export function levelProgress(xp: number) {
  const level = levelForXp(xp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);

  return {
    level,
    xp,
    currentLevelXp,
    nextLevelXp,
    progress: (xp - currentLevelXp) / (nextLevelXp - currentLevelXp),
  };
}
