import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	ParseIntPipe,
	Patch,
	Post,
	Query,
	Request,
	Res,
	UseGuards,
  } from '@nestjs/common';
  import type { Response } from 'express';

  import { UsersService } from './users.service';
  import { CreateUserDto } from './create-user.dto';
  import { JwtAuthGuard } from '../auth/jwt-auth-guard';
  import { Role } from '@prisma/client';
  import { Roles } from '../auth/roles.decorator';
  import { RolesGuard } from '../auth/roles.guard';
  import { UpdateUserRoleDto } from './update-user-role.dto';
  import { UpdateMeDto } from './update-me.dto';
  import { UpdatePasswordDto } from './update-password.dto';
  import { AdminUpdateUserDto } from './admin-update-user.dto';
  import { DeleteAccountDto } from './delete-account.dto';
  import { ListUsersDto } from './list-users.dto';
  import { AvailabilityDto } from './availability.dto';

  // Static routes (me, password) are declared before the ":id" ones.
  @Controller('users')
  export class UsersController {

	constructor(private readonly usersService: UsersService) {}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Get()
	findAll(@Query() query: ListUsersDto) {
	  return this.usersService.findAll(query);
	}

	@Post()
	create(@Body() createUserDto: CreateUserDto) {
	  return this.usersService.create(createUserDto);
	}

	// Public: is this username / email still free? (registration form)
	@Get('availability')
	availability(@Query() query: AvailabilityDto) {
	  return this.usersService.availability(query);
	}

	@UseGuards(JwtAuthGuard)
	@Get('me')
	getMe(@Request() req) {
	  return this.usersService.findMe(req.user.id);
	}

	@UseGuards(JwtAuthGuard)
	@Patch('me')
	updateMe(
	  @Request() req,
	  @Body() updateMeDto: UpdateMeDto,
	) {
	  return this.usersService.updateMe(
		req.user.id,
		updateMeDto,
	  );
	}

	@UseGuards(JwtAuthGuard)
	@Delete('me')
	deleteMe(
	  @Request() req,
	  @Body() deleteAccountDto: DeleteAccountDto,
	) {
	  return this.usersService.deleteMe(req.user.id, deleteAccountDto.password);
	}

	@UseGuards(JwtAuthGuard)
	@Patch('password')
	updatePassword(
	  @Request() req,
	  @Body() updatePasswordDto: UpdatePasswordDto,
	) {
	  return this.usersService.updatePassword(
		req.user.id,
		updatePasswordDto,
	  );
	}

	// Public: uploaded avatar or the generated default one.
	@Get(':id/avatar')
	async getAvatar(
	  @Param('id', ParseIntPipe) id: number,
	  @Res() res: Response,
	) {
	  const avatar = await this.usersService.getAvatar(id);

	  res.set({
		'Content-Type': avatar.contentType,
		'Cache-Control': 'public, max-age=86400',
		'X-Content-Type-Options': 'nosniff',
	  });
	  res.send(avatar.body);
	}

	// Public profile (shown when clicking a player on the leaderboard).
	@Get(':id/profile')
	getProfile(@Param('id', ParseIntPipe) id: number) {
	  return this.usersService.getPublicProfile(id);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Get(':id')
	findOne(@Param('id', ParseIntPipe) id: number) {
	  return this.usersService.findOne(id);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Patch(':id')
	adminUpdate(
	  @Request() req,
	  @Param('id', ParseIntPipe) id: number,
	  @Body() dto: AdminUpdateUserDto,
	) {
	  return this.usersService.adminUpdate(req.user.id, id, dto);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Delete(':id')
	adminDelete(
	  @Request() req,
	  @Param('id', ParseIntPipe) id: number,
	) {
	  return this.usersService.adminDelete(req.user.id, id);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Patch(':id/role')
	updateRole(
	  @Param('id', ParseIntPipe) id: number,
	  @Body() updateUserRoleDto: UpdateUserRoleDto,
	) {
	  return this.usersService.updateRole(
		id,
		updateUserRoleDto.role,
	  );
	}
  }
