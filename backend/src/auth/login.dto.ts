import { IsEmail, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

// Log in with email + password (what the web form sends).
// `username` is still accepted instead of `email` for scripts and older clients.
export class LoginDto {
  @ValidateIf((dto) => !dto.username)
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email?: string;

  @ValidateIf((dto) => !dto.email)
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  username?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password: string;
}
