import {
	IsOptional,
	IsString,
	Matches,
	MaxLength,
  } from 'class-validator';
import {
	AVATAR_MAX_LENGTH,
	AVATAR_MESSAGE,
	AVATAR_PATTERN,
	USERNAME_MESSAGE,
	USERNAME_PATTERN,
} from './user-validation';

  export class UpdateMeDto {

	@IsOptional()
	@IsString()
	@Matches(USERNAME_PATTERN, { message: USERNAME_MESSAGE })
	username?: string;

	// null removes the avatar (the default one is shown instead).
	@IsOptional()
	@IsString()
	@MaxLength(AVATAR_MAX_LENGTH, { message: 'avatar image is too large' })
	@Matches(AVATAR_PATTERN, { message: AVATAR_MESSAGE })
	avatar?: string | null;
}
