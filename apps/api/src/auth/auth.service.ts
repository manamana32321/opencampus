import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service.js';

interface GoogleProfile {
  email: string;
  name: string;
  picture: string;
  googleRefreshToken: string | null;
}

interface JwtPayload {
  sub: number;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async upsertUser(profile: GoogleProfile) {
    return this.prisma.user.upsert({
      where: { email: profile.email },
      update: {
        name: profile.name,
        picture: profile.picture,
        googleRefreshToken: profile.googleRefreshToken,
      },
      create: {
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
        googleRefreshToken: profile.googleRefreshToken,
      },
    });
  }

  signJwt(userId: number, email: string): string {
    const secret = this.configService.getOrThrow<string>('JWT_SECRET');
    return jwt.sign({ sub: userId, email } satisfies JwtPayload, secret, {
      expiresIn: '7d',
    });
  }

  verifyJwt(token: string): JwtPayload {
    const secret = this.configService.getOrThrow<string>('JWT_SECRET');
    return jwt.verify(token, secret) as unknown as JwtPayload;
  }
}
