import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import type { Request } from 'express';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  validate(req: Request): { userId: number; email: string } {
    const apiKey = req.headers['x-api-key'];
    const expectedKey =
      this.configService.getOrThrow<string>('OPENCAMPUS_API_KEY');

    if (!apiKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    const userIdHeader = req.headers['x-user-id'];
    if (!userIdHeader) {
      throw new UnauthorizedException(
        'x-user-id header is required when using API key',
      );
    }

    const userId = parseInt(userIdHeader as string, 10);
    if (isNaN(userId)) {
      throw new UnauthorizedException('x-user-id must be a valid integer');
    }

    return { userId, email: 'api-key' };
  }
}
