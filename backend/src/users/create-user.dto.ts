import { IsEmail, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  // Ignored: the server sets the starting balance (see users.service.ts).
  // Still accepted because the current registration form sends it.
  @IsOptional()
  @IsNumber()
  wallet?: number;

  @IsOptional()
  @IsString()
  avatar?: string;
}