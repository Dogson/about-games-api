import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SequelizeExceptionFilter } from './filters/sequelize-exception.filter';
import { parseCorsOrigins } from './config/cors.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Enable validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new SequelizeExceptionFilter());

  // Enable CORS for the configured origins (defaults to all localhost origins)
  app.enableCors({
    origin: parseCorsOrigins(configService.get<string>('CORS_ORIGINS')),
    credentials: true, // if you want cookies/auth headers to work
  });

  await app.listen(configService.get<number>('PORT') ?? 5000, '0.0.0.0');
}
bootstrap();
