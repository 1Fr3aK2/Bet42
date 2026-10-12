import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { USERNAME_MESSAGE, USERNAME_PATTERN } from './user-validation';

// Fields an admin can change on another account (PATCH /users/:id).
// Role changes keep their own endpoint (PATCH /users/:id/role).
export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  @Matches(USERNAME_PATTERN, { message: USERNAME_MESSAGE })
  username?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email?: string;

  // Sets the exact balance; the difference is recorded as ADMIN_ADJUSTMENT.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  wallet?: number;
}
