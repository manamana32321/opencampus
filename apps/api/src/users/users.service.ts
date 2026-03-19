import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: number) {
    return this.prisma.user.findUniqueOrThrow({ where: { id } });
  }

  async update(id: number, data: { canvasAccessToken?: string; name?: string }) {
    return this.prisma.user.update({ where: { id }, data });
  }
}
