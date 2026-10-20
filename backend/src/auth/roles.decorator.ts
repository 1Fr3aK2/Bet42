import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

// Creates a custom decorator to define which roles can access an endpoint
export const Roles = (...roles: Role[]) =>  // ... collects all arguments into an array of Role values (rest parameter)
  SetMetadata(ROLES_KEY, roles);            // Stores the allowed roles as metadata, which the RolesGuard will read
