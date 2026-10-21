import { Injectable } from '@nestjs/common';
import type { ModerationResult } from './moderation.types';

@Injectable()
export class AutomaticModerationService {
  analyzeText(text: string): ModerationResult {

    const normalizedText = text.toLowerCase();
    const reasons: string[] = [];       // const prevents reassignment, but the array itself remains mutable
    let score = 0;                      // let allows the variable to be reassigned

    const scamExpressions = [
      'guaranteed profit',
      'guaranteed return',
      'free money',
      'double your money',
      'crypto signals',
      'send me bitcoin',
      'send me crypto',
    ];

    const spamExpressions = [
      'click here',
      'join now',
      'limited offer',
      'buy now',
      'subscribe now',
    ];

    const abusiveExpressions = [
      'idiot',
      'stupid',
      'moron',
      'fuck you',
      'kill yourself',
    ];

    if (
      scamExpressions.some((expression) =>      // Checks if any expression is included in the normalized text
        normalizedText.includes(expression),    // .some() is an array method that takes a function as an argument
      )
    ) {
      reasons.push('Possible financial scam');
      score += 0.4;
    }

    if (
      spamExpressions.some((expression) =>
        normalizedText.includes(expression),
      )
    ) {
      reasons.push('Possible spam');
      score += 0.25;
    }

    if (
      abusiveExpressions.some((expression) =>
        normalizedText.includes(expression),
      )
    ) {
      reasons.push('Possible abusive language');
      score += 0.5;
    }

    if (
      normalizedText.includes('http://') ||
      normalizedText.includes('https://')
    ) {
      reasons.push('Contains external link');
      score += 0.2;
    }

    if (this.hasExcessiveUppercase(text)) {
      reasons.push('Excessive uppercase text');
      score += 0.15;
    }

    if (this.hasExcessiveRepetition(text)) {
      reasons.push('Excessive repeated characters');
      score += 0.15;
    }

    score = Math.min(score, 1);               // Limits the score to a maximum of 1

    if (score >= 0.7) {
      return {
        decision: 'rejected',
        score,
        reasons,
      };
    }

    if (score >= 0.3) {
      return {
        decision: 'flagged',
        score,
        reasons,
      };
    }

    return {
      decision: 'approved',
      score,
      reasons,
    };
  }

  /*

  Regex syntax used below:

    /.../   → regex delimiters (start/end)
    \p{...} → matches characters by Unicode properties
    \p{L}   → matches any character in the Unicode "Letter" category
    \p{Lu}  → matches any character in the Unicode "Uppercase Letter" category
    g       → global flag: finds all matches, not just the first
    u       → Unicode flag: interprets the regex in Unicode mode

  */
  private hasExcessiveUppercase(text: string): boolean {

    const letters =
      text.match(/\p{L}/gu)?.length ?? 0;                   // Matches Unicode letters and stores their count (0 if none)
                                                            // ?. handles a possible null from match() (returning undefined); ?? 0 uses 0 if no match is found
    if (letters < 10)                                       // Ignores short texts or texts without letters (e.g. "YES!", "OK")
      return false;

    const uppercaseLetters =
      text.match(/\p{Lu}/gu)?.length ?? 0;                  // Matches uppercase Unicode letters and stores their count (0 if none)

    return uppercaseLetters / letters > 0.7;                // Returns true if more than 70% of the letters are uppercase
  }

  /*
    Regex syntax used below:

      (.)     → captures any character (as group 1, since it is the first and only capture group)
      \1      → backreference to group 1 (matches the same captured character)
      {5,}    → matches the preceding pattern 5 or more times (the comma means "or more")
      i       → case-insensitive flag
      .test() → returns true if the regex finds a match

  */
  private hasExcessiveRepetition(text: string): boolean {
    return /(.)\1{5,}/i.test(text);                       // Returns true if the same character is repeated at least 6 times consecutively
  }
}
