import { IsInt, IsPositive, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

// Send a request by username (friends page) or by id (profile page).
export class SendFriendRequestDto {
  @ValidateIf((dto) => dto.userId === undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  username?: string;

  @ValidateIf((dto) => dto.username === undefined)
  @IsInt()
  @IsPositive()
  userId?: number;
}
