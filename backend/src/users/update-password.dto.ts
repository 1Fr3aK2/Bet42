import {
	IsString,
	Matches,
	MaxLength,
  } from 'class-validator';
import { PASSWORD_MESSAGE, PASSWORD_PATTERN } from './user-validation';

  export class UpdatePasswordDto {

	@IsString()
	@MaxLength(72)
	currentPassword: string;

	@IsString()
	@Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
	newPassword: string;
  }
