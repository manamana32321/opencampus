import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { CoursesModule } from './courses/courses.module.js';
import { StorageModule } from './storage/storage.module.js';
import { WeeksModule } from './weeks/weeks.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { MaterialsModule } from './materials/materials.module.js';
import { ProcessorsModule } from './processors/processors.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StorageModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CoursesModule,
    WeeksModule,
    JobsModule,
    MaterialsModule,
    ProcessorsModule,
  ],
})
export class AppModule {}
