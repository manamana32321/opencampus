import { Controller, Get, Patch, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { UsersService } from './users.service.js';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('me')
  async getMe(@Req() req: any) {
    const user = await this.users.findById(req.user.userId);
    // Don't expose sensitive fields
    const { googleRefreshToken, canvasAccessToken, ...safe } = user;
    return { ...safe, hasCanvasToken: !!canvasAccessToken };
  }

  @Patch('me')
  async updateMe(@Req() req: any, @Body() body: { canvasAccessToken?: string; name?: string }) {
    await this.users.update(req.user.userId, body);
    return { ok: true };
  }
}
