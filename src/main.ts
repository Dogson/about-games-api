import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SequelizeExceptionFilter } from './filters/sequelize-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips properties that do not have decorators
      forbidNonWhitelisted: false, // throw error if extra props sent
      transform: true, // transform payloads to DTO instances
    }),
  );

  app.useGlobalFilters(new SequelizeExceptionFilter());

  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
