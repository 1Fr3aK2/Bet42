import { Role } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ListUsersDto {
  // Matches username or email (case-insensitive).
  @IsOptional()
  @IsString()
  @MaxLength(254)
  search?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
