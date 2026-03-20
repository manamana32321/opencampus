import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser') as () => unknown;
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(cookieParser());
  const frontendUrl: string = config.getOrThrow('FRONTEND_URL');
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

  const port: number = config.get<number>('PORT') ?? 4000;
  await app.listen(port);
}
void bootstrap();
