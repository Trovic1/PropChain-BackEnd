/**
 * @fileoverview A guard to protect routes for admin users only.
 * @issue #206
 */

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // In a real app, this would be a more robust check (e.g., user.roles.includes('admin'))
    return user && user.role === 'admin';
  }
}