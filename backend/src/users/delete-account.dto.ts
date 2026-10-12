import { IsString, MaxLength, MinLength } from 'class-validator';

// Deleting your own account requires typing the password again.
export class DeleteAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password: string;
}
