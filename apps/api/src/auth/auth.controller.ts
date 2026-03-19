import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';

interface GoogleUser {
  email: string;
  name: string;
  picture: string;
  googleRefreshToken: string | null;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth(): void {
    // Passport redirects to Google — no body needed
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @Req() req: Request & { user: GoogleUser },
    @Res() res: Response,
  ): Promise<void> {
    const user = await this.authService.upsertUser(req.user);
    const token = this.authService.signJwt(user.id, user.email);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    });

    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    res.redirect(`${frontendUrl}/dashboard`);
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const cookies = req.cookies as Record<string, string> | undefined;
    const oldToken = cookies?.['token'];
    if (!oldToken) {
      throw new UnauthorizedException('No token cookie found');
    }

    let payload: { sub: number; email: string };
    try {
      payload = this.authService.verifyJwt(oldToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const newToken = this.authService.signJwt(payload.sub, payload.email);

    res.cookie('token', newToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ ok: true });
  }
}
