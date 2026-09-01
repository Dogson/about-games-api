import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SequelizeExceptionFilter } from './filters/sequelize-exception.filter';

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

  // Enable CORS for all localhost origins
  app.enableCors({
    origin: /http:\/\/localhost:\d+/,
    credentials: true, // if you want cookies/auth headers to work
  });

  await app.listen(configService.get<number>('PORT') ?? 5000, '0.0.0.0');
}
bootstrap();
