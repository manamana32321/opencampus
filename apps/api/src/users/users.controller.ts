import { Controller, Get, Patch, Body, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard.js';
import { UsersService } from './users.service.js';

interface AuthRequest extends Request {
  user: { userId: number };
}

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('me')
  async getMe(@Req() req: AuthRequest) {
    const user = await this.users.findById(req.user.userId);
    // Don't expose sensitive fields
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { googleRefreshToken, canvasAccessToken, ...safe } = user;
    return { ...safe, hasCanvasToken: !!canvasAccessToken };
  }

  @Patch('me')
  async updateMe(
    @Req() req: AuthRequest,
    @Body() body: { canvasAccessToken?: string; name?: string },
  ) {
    await this.users.update(req.user.userId, body);
    return { ok: true };
  }
}
