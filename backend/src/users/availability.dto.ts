import { IsOptional, IsString, MaxLength } from 'class-validator';

// GET /users/availability?username=...&email=... (registration form)
export class AvailabilityDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  email?: string;
}
